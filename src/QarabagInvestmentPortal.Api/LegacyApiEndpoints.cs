using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json.Nodes;

namespace QarabagInvestmentPortal.Api;

internal static partial class LegacyApiEndpoints
{
    private static readonly ConcurrentDictionary<string, Session> Sessions = new();
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(7);

    public static IEndpointRouteBuilder MapLegacyApi(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api");

        MapAuth(api);
        MapLands(api);
        MapCompetitions(api);
        MapApplications(api);
        MapFavorites(api);
        MapNotifications(api);
        MapAdmin(api);
        MapRecommendations(api);
        MapAssistant(api);

        return endpoints;
    }

    private static void MapAuth(RouteGroupBuilder api)
    {
        api.MapPost("/auth/register", (JsonObject body, LegacyDatabase db, HttpResponse response) =>
        {
            var firstName = S(body, "firstName").Trim();
            var lastName = S(body, "lastName").Trim();
            var email = S(body, "email").Trim().ToLowerInvariant();
            var phone = S(body, "phone").Trim();
            var password = S(body, "password");

            if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName) ||
                string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(password))
                return Error(400, "Bütün məcburi sahələr doldurulmalıdır.");
            if (password != S(body, "confirmPassword"))
                return Error(400, "Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.");
            if (password.Length < 6)
                return Error(400, "Şifrə ən azı 6 simvoldan ibarət olmalıdır.");

            return db.Write(root =>
            {
                if (Table(root, "users").OfType<JsonObject>().Any(x =>
                        S(x, "email").Equals(email, StringComparison.OrdinalIgnoreCase)))
                    return Error(409, "Bu elektron poçt ünvanı artıq sistemdə qeydiyyatdan keçib.");

                var now = Now();
                var id = Id("usr");
                var user = new JsonObject
                {
                    ["id"] = id, ["firstName"] = firstName, ["lastName"] = lastName,
                    ["email"] = email, ["phone"] = phone, ["role"] = "ENTREPRENEUR",
                    ["passwordHash"] = BCrypt.Net.BCrypt.HashPassword(password),
                    ["createdAt"] = now, ["updatedAt"] = now
                };
                Table(root, "users").Add(user);

                var profile = new JsonObject
                {
                    ["id"] = Id("prof"), ["userId"] = id,
                    ["companyName"] = S(body, "companyName"),
                    ["taxIdentificationNumber"] = S(body, "taxIdentificationNumber"),
                    ["businessActivity"] = S(body, "businessActivity"),
                    ["createdAt"] = now, ["updatedAt"] = now
                };
                Table(root, "entrepreneurProfiles").Add(profile);
                var token = CreateSession(id, response);
                return Results.Json(new JsonObject
                {
                    ["message"] = "Qeydiyyat uğurla tamamlandı.", ["token"] = token,
                    ["user"] = SafeUser(user), ["profile"] = profile.DeepClone()
                }, statusCode: 201);
            });
        });

        api.MapPost("/auth/login", (JsonObject body, LegacyDatabase db, HttpResponse response) =>
        {
            var email = S(body, "email");
            var password = S(body, "password");
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return Error(400, "E-poçt və şifrə daxil edilməlidir.");

            return db.Read(root =>
            {
                var user = Find(root, "users", x => S(x, "email").Equals(email, StringComparison.OrdinalIgnoreCase));
                if (user is null || !BCrypt.Net.BCrypt.Verify(password, S(user, "passwordHash")))
                    return Error(401, "E-poçt və ya şifrə yanlışdır.");

                var token = CreateSession(S(user, "id"), response);
                var profile = Find(root, "entrepreneurProfiles", x => S(x, "userId") == S(user, "id"));
                return Results.Json(new JsonObject
                {
                    ["message"] = "Uğurla daxil oldunuz.", ["token"] = token,
                    ["user"] = SafeUser(user), ["profile"] = profile?.DeepClone()
                });
            });
        });

        api.MapPost("/auth/logout", (HttpRequest request, HttpResponse response) =>
        {
            var token = Token(request);
            if (token is not null) Sessions.TryRemove(token, out _);
            response.Cookies.Delete("agroinvest_session");
            return Results.Json(new { message = "Sistemdən uğurla çıxış edildi." });
        });

        api.MapGet("/auth/me", (HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request);
            if (userId is null) return Error(401, "Aktiv sessiya tapılmadı.");
            return db.Read(root =>
            {
                var user = FindById(root, "users", userId);
                if (user is null) return Error(401, "Aktiv sessiya tapılmadı.");
                var profile = Find(root, "entrepreneurProfiles", x => S(x, "userId") == userId);
                return Results.Json(new JsonObject { ["user"] = SafeUser(user), ["profile"] = profile?.DeepClone() });
            });
        });

        api.MapMethods("/auth/profile", ["PATCH"], (JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request);
            if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Write(root =>
            {
                var user = FindById(root, "users", userId);
                if (user is null) return Error(401, "Giriş tələb olunur.");
                MergePresent(user, body, "firstName", "lastName", "phone");
                user["updatedAt"] = Now();

                var profile = Find(root, "entrepreneurProfiles", x => S(x, "userId") == userId);
                if (profile is null)
                {
                    profile = new JsonObject { ["id"] = Id("prof"), ["userId"] = userId, ["createdAt"] = Now() };
                    Table(root, "entrepreneurProfiles").Add(profile);
                }
                MergePresent(profile, body, "companyName", "taxIdentificationNumber", "businessActivity");
                profile["updatedAt"] = Now();
                return Results.Json(new JsonObject
                {
                    ["message"] = "Profil məlumatları yeniləndi.", ["user"] = SafeUser(user),
                    ["profile"] = profile.DeepClone()
                });
            });
        });
    }

    private static void MapLands(RouteGroupBuilder api)
    {
        api.MapGet("/lands", (HttpRequest request, LegacyDatabase db) => db.Read(root =>
        {
            var admin = IsAdmin(request, root);
            var query = request.Query;
            IEnumerable<JsonObject> lands = Table(root, "lands").OfType<JsonObject>();
            if (!admin) lands = lands.Where(x => S(x, "status") == "PUBLISHED");
            lands = Filter(lands, query, "region", "region");
            lands = Filter(lands, query, "agricultureType", "agricultureType");
            if (double.TryParse(query["minArea"], CultureInfo.InvariantCulture, out var min)) lands = lands.Where(x => N(x, "areaHectares") >= min);
            if (double.TryParse(query["maxArea"], CultureInfo.InvariantCulture, out var max)) lands = lands.Where(x => N(x, "areaHectares") <= max);
            if (admin && !string.IsNullOrWhiteSpace(query["status"])) lands = lands.Where(x => S(x, "status") == query["status"]);
            var search = query["search"].ToString();
            if (!string.IsNullOrWhiteSpace(search)) lands = lands.Where(x =>
                new[] { "title", "region", "description", "intendedUse" }.Any(p => S(x, p).Contains(search, StringComparison.OrdinalIgnoreCase)));
            return Results.Json(CloneArray(lands));
        }));

        api.MapGet("/lands/{id}", (string id, LegacyDatabase db) => db.Read(root =>
        {
            var land = FindById(root, "lands", id);
            if (land is null) return Error(404, "Torpaq sahəsi tapılmadı.");
            var result = (JsonObject)land.DeepClone();
            var comps = Table(root, "competitions").OfType<JsonObject>().Where(x => S(x, "landId") == id).ToList();
            result["competitions"] = CloneArray(comps.Select(x => Competition(root, x)));
            result["activeCompetition"] = comps.FirstOrDefault(x => S(x, "status") == "ACTIVE") is { } active
                ? Competition(root, active) : null;
            return Results.Json(result);
        }));

        api.MapPost("/admin/lands", (JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            if (!db.Read(root => IsAdmin(request, root))) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            if (new[] { "title", "region", "areaHectares", "agricultureType", "intendedUse" }.Any(x => string.IsNullOrWhiteSpace(S(body, x))))
                return Error(400, "Məcburi sahələri doldurun (Ad, Region, Sahə, Fəaliyyət növü, Təyinat).");
            return db.Write(root =>
            {
                var now = Now();
                var land = (JsonObject)body.DeepClone();
                land["id"] = Id("land"); land["areaHectares"] = N(body, "areaHectares");
                land["latitude"] = N(body, "latitude") == 0 ? 39.8 : N(body, "latitude");
                land["longitude"] = N(body, "longitude") == 0 ? 46.8 : N(body, "longitude");
                land["estimatedInvestmentRequirement"] = N(body, "estimatedInvestmentRequirement");
                land["description"] = S(body, "description"); land["status"] = "PUBLISHED";
                land["imageUrl"] = S(body, "imageUrl") is { Length: > 0 } image ? image : "/src/assets/images/category_crop_farming_1791976992217.jpg";
                land["soilQuality"] = S(body, "soilQuality") is { Length: > 0 } soil ? soil : "Münbit torpaq";
                land["waterSupply"] = S(body, "waterSupply") is { Length: > 0 } water ? water : "Dövlət suvarma kanalı";
                land["createdAt"] = now; land["updatedAt"] = now;
                Table(root, "lands").Add(land);
                return Results.Json(land.DeepClone(), statusCode: 201);
            });
        });

        api.MapMethods("/admin/lands/{id}", ["PATCH"], (string id, JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            if (!db.Read(root => IsAdmin(request, root))) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            return db.Write(root =>
            {
                var land = FindById(root, "lands", id);
                if (land is null) return Error(404, "Torpaq sahəsi tapılmadı.");
                Merge(land, body); land["updatedAt"] = Now();
                return Results.Json(land.DeepClone());
            });
        });
    }

    private static void MapCompetitions(RouteGroupBuilder api)
    {
        api.MapGet("/competitions", (HttpRequest request, LegacyDatabase db) => db.Read(root =>
        {
            var admin = IsAdmin(request, root);
            IEnumerable<JsonObject> comps = Table(root, "competitions").OfType<JsonObject>();
            if (!admin) comps = comps.Where(x => S(x, "status") is "ACTIVE" or "CLOSED");
            if (!string.IsNullOrWhiteSpace(request.Query["status"])) comps = comps.Where(x => S(x, "status") == request.Query["status"]);
            if (!string.IsNullOrWhiteSpace(request.Query["region"]) && request.Query["region"] != "all")
                comps = comps.Where(x => S(FindById(root, "lands", S(x, "landId")), "region").Equals(request.Query["region"], StringComparison.OrdinalIgnoreCase));
            return Results.Json(CloneArray(comps.Select(x => Competition(root, x))));
        }));

        api.MapGet("/competitions/{id}", (string id, LegacyDatabase db) => db.Read(root =>
            FindById(root, "competitions", id) is { } comp ? Results.Json(Competition(root, comp)) : Error(404, "Müsabiqə tapılmadı.")));

        api.MapPost("/admin/competitions", (JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            if (!db.Read(root => IsAdmin(request, root))) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            if (string.IsNullOrWhiteSpace(S(body, "landId")) || string.IsNullOrWhiteSpace(S(body, "title")) || string.IsNullOrWhiteSpace(S(body, "applicationDeadline")))
                return Error(400, "Torpaq sahəsi, müsabiqə adı və son müraciət tarixi tələb olunur.");
            return db.Write(root =>
            {
                var now = Now(); var comp = (JsonObject)body.DeepClone();
                comp["id"] = Id("comp"); comp["description"] = S(body, "description");
                comp["eligibilityConditions"] ??= new JsonArray(); comp["requiredDocuments"] ??= new JsonArray();
                comp["openingDate"] = S(body, "openingDate") is { Length: > 0 } opening ? opening : now;
                comp["status"] = "ACTIVE"; comp["createdAt"] = now; comp["updatedAt"] = now;
                Table(root, "competitions").Add(comp);
                return Results.Json(Competition(root, comp), statusCode: 201);
            });
        });

        api.MapMethods("/admin/competitions/{id}", ["PATCH"], (string id, JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            if (!db.Read(root => IsAdmin(request, root))) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            return db.Write(root =>
            {
                var comp = FindById(root, "competitions", id);
                if (comp is null) return Error(404, "Müsabiqə tapılmadı.");
                Merge(comp, body); comp["updatedAt"] = Now(); return Results.Json(Competition(root, comp));
            });
        });
    }

    private static void MapApplications(RouteGroupBuilder api)
    {
        api.MapPost("/applications", (JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            if (string.IsNullOrWhiteSpace(S(body, "competitionId")) || N(body, "proposedInvestmentAmount") <= 0 || string.IsNullOrWhiteSpace(S(body, "businessPlanSummary")))
                return Error(400, "Müsabiqə seçimi, investisiya məbləği və biznes-plan xülasəsi mütləqdir.");
            return db.Write(root =>
            {
                var comp = FindById(root, "competitions", S(body, "competitionId"));
                if (comp is null) return Error(404, "Seçilmiş müsabiqə tapılmadı.");
                if (S(comp, "status") != "ACTIVE") return Error(400, "Bu müsabiqə üzrə müraciət qəbulu dayandırılmışdır.");
                if (DateTimeOffset.TryParse(S(comp, "applicationDeadline"), out var deadline) && DateTimeOffset.UtcNow > deadline)
                    return Error(400, "Müsabiqənin son müraciət tarixi başa çatmışdır.");

                var now = Now(); var apps = Table(root, "applications");
                var app = new JsonObject
                {
                    ["id"] = Id("app"), ["referenceNumber"] = $"AGRO-2026-{apps.Count + 1:0000}",
                    ["userId"] = userId, ["competitionId"] = S(body, "competitionId"),
                    ["proposedInvestmentAmount"] = N(body, "proposedInvestmentAmount"),
                    ["businessPlanSummary"] = S(body, "businessPlanSummary"),
                    ["estimatedImplementationPeriod"] = S(body, "estimatedImplementationPeriod") is { Length: > 0 } period ? period : "24 ay",
                    ["status"] = "RECEIVED", ["decisionOutcome"] = "NONE", ["submittedAt"] = now, ["updatedAt"] = now
                };
                apps.Add(app);
                Table(root, "statusHistory").Add(new JsonObject
                {
                    ["id"] = Id("hist"), ["applicationId"] = S(app, "id"), ["previousStatus"] = "RECEIVED",
                    ["newStatus"] = "RECEIVED", ["changedBy"] = "Sistem",
                    ["comment"] = "Müraciət elektron qaydada təqdim olundu və qeydiyyata alındı.", ["createdAt"] = now
                });
                AddNotification(root, userId, "Müraciətiniz qeydə alındı", $"{S(app, "referenceNumber")} nömrəli müraciətiniz uğurla təqdim edildi.");
                if (body["documents"] is JsonArray docs)
                    foreach (var item in docs.OfType<JsonObject>()) AddDocument(root, S(app, "id"), item);
                return Results.Json(PopulateApplication(root, app), statusCode: 201);
            });
        });

        api.MapGet("/applications/my", (HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Read(root => Results.Json(CloneArray(Table(root, "applications").OfType<JsonObject>()
                .Where(x => S(x, "userId") == userId).Select(x => PopulateApplication(root, x)))));
        });

        api.MapGet("/applications/{id}", (string id, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Read(root =>
            {
                var app = Find(root, "applications", x => S(x, "id") == id || S(x, "referenceNumber") == id);
                if (app is null) return Error(404, "Müraciət tapılmadı.");
                if (!IsAdmin(request, root) && S(app, "userId") != userId) return Error(403, "Bu müraciətə baxmaq hüququnuz yoxdur.");
                return Results.Json(PopulateApplication(root, app));
            });
        });

        api.MapPost("/applications/{id}/documents", (string id, JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            if (string.IsNullOrWhiteSpace(S(body, "fileName"))) return Error(400, "Fayl adı qeyd olunmalıdır.");
            if (N(body, "fileSize") > 15 * 1024 * 1024) return Error(400, "Faylın həcmi 15MB-dan çox ola bilməz.");
            return db.Write(root =>
            {
                var app = FindById(root, "applications", id);
                if (app is null) return Error(404, "Müraciət tapılmadı.");
                if (!IsAdmin(request, root) && S(app, "userId") != userId) return Error(403, "İcazə verilmədi.");
                return Results.Json(AddDocument(root, id, body), statusCode: 201);
            });
        });

        api.MapPost("/applications/{id}/respond-info", (string id, JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Write(root =>
            {
                var app = FindById(root, "applications", id);
                if (app is null) return Error(404, "Müraciət tapılmadı.");
                if (S(app, "userId") != userId) return Error(403, "İcazə verilmədi.");
                var info = FindById(root, "infoRequests", S(body, "requestId"));
                if (info is null) return Error(404, "Sorğu tapılmadı.");
                info["response"] = S(body, "responseText"); info["status"] = "ANSWERED"; info["respondedAt"] = Now();
                ChangeStatus(root, app, "UNDER_REVIEW", "Sahibkar", "Sahibkar tərəfindən əlavə məlumat təqdim olundu.", "NONE", null);
                return Results.Json(new JsonObject { ["message"] = "Cavabınız uğurla göndərildi.", ["application"] = PopulateApplication(root, app) });
            });
        });
    }

    private static void MapFavorites(RouteGroupBuilder api)
    {
        api.MapGet("/favorites", (HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Read(root => Results.Json(CloneArray(Table(root, "favorites").OfType<JsonObject>().Where(x => S(x, "userId") == userId).Select(x =>
            {
                var fav = (JsonObject)x.DeepClone(); fav["land"] = FindById(root, "lands", S(x, "landId"))?.DeepClone(); return fav;
            }))));
        });
        api.MapPost("/favorites", (JsonObject body, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            var landId = S(body, "landId"); if (string.IsNullOrWhiteSpace(landId)) return Error(400, "Torpaq sahəsi seçilməlidir.");
            return db.Write(root =>
            {
                var existing = Find(root, "favorites", x => S(x, "userId") == userId && S(x, "landId") == landId);
                var fav = existing ?? new JsonObject { ["id"] = Id("fav"), ["userId"] = userId, ["landId"] = landId, ["createdAt"] = Now() };
                if (existing is null) Table(root, "favorites").Add(fav);
                var result = (JsonObject)fav.DeepClone(); result["land"] = FindById(root, "lands", landId)?.DeepClone();
                return Results.Json(result, statusCode: 201);
            });
        });
        api.MapDelete("/favorites/{landId}", (string landId, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Write(root =>
            {
                var array = Table(root, "favorites"); var found = array.OfType<JsonObject>().FirstOrDefault(x => S(x, "userId") == userId && S(x, "landId") == landId);
                if (found is not null) array.Remove(found); return Results.Json(new { success = found is not null });
            });
        });
    }

    private static void MapNotifications(RouteGroupBuilder api)
    {
        api.MapGet("/notifications", (HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Read(root => Results.Json(CloneArray(Table(root, "notifications").OfType<JsonObject>()
                .Where(x => S(x, "userId") == userId).OrderByDescending(x => S(x, "createdAt")))));
        });
        api.MapMethods("/notifications/{id}/read", ["PATCH"], (string id, HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Write(root => { var item = Find(root, "notifications", x => S(x, "id") == id && S(x, "userId") == userId); if (item is not null) item["isRead"] = true; return Results.Json(new { success = item is not null }); });
        });
        api.MapPost("/notifications/read-all", (HttpRequest request, LegacyDatabase db) =>
        {
            var userId = UserId(request); if (userId is null) return Error(401, "Giriş tələb olunur.");
            return db.Write(root => { foreach (var item in Table(root, "notifications").OfType<JsonObject>().Where(x => S(x, "userId") == userId)) item["isRead"] = true; return Results.Json(new { success = true }); });
        });
    }

    private static void MapAdmin(RouteGroupBuilder api)
    {
        api.MapGet("/admin/applications", (HttpRequest request, LegacyDatabase db) => db.Read(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            IEnumerable<JsonObject> apps = Table(root, "applications").OfType<JsonObject>();
            if (!string.IsNullOrWhiteSpace(request.Query["status"]) && request.Query["status"] != "all") apps = apps.Where(x => S(x, "status") == request.Query["status"]);
            var populated = apps.Select(x => PopulateApplication(root, x));
            if (!string.IsNullOrWhiteSpace(request.Query["region"]) && request.Query["region"] != "all") populated = populated.Where(x => S(x["land"] as JsonObject, "region").Equals(request.Query["region"], StringComparison.OrdinalIgnoreCase));
            var search = request.Query["search"].ToString();
            if (!string.IsNullOrWhiteSpace(search)) populated = populated.Where(x => x.ToJsonString().Contains(search, StringComparison.OrdinalIgnoreCase));
            return Results.Json(CloneArray(populated));
        }));

        api.MapGet("/admin/applications/{id}", (string id, HttpRequest request, LegacyDatabase db) => db.Read(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            var app = FindById(root, "applications", id); return app is null ? Error(404, "Müraciət tapılmadı.") : Results.Json(PopulateApplication(root, app));
        }));

        api.MapMethods("/admin/applications/{id}/status", ["PATCH"], (string id, JsonObject body, HttpRequest request, LegacyDatabase db) => db.Write(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            var app = FindById(root, "applications", id); if (app is null) return Error(404, "Müraciət tapılmadı.");
            var status = S(body, "status"); var valid = new[] { "RECEIVED", "UNDER_REVIEW", "ADDITIONAL_INFORMATION_REQUIRED", "DECIDED" };
            if (!valid.Contains(status)) return Error(400, "Yol verilməz status dəyəri.");
            if (status == "DECIDED" && S(body, "decisionOutcome") is "" or "NONE") return Error(400, "Qərar verildikdə yekun nəticə seçilməlidir.");
            var admin = CurrentUser(request, root)!; ChangeStatus(root, app, status, $"{S(admin, "firstName")} {S(admin, "lastName")} (İnzibatçı)", S(body, "comment"), S(body, "decisionOutcome"), S(body, "decisionNote"));
            return Results.Json(PopulateApplication(root, app));
        }));

        api.MapPost("/admin/applications/{id}/information-request", (string id, JsonObject body, HttpRequest request, LegacyDatabase db) => db.Write(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            var app = FindById(root, "applications", id); if (app is null) return Error(404, "Müraciət tapılmadı.");
            if (string.IsNullOrWhiteSpace(S(body, "message"))) return Error(400, "Tələb olunan məlumatın mətni yazılmalıdır.");
            var admin = CurrentUser(request, root)!; var requestedBy = $"{S(admin, "firstName")} {S(admin, "lastName")} (İnzibatçı)";
            var info = new JsonObject { ["id"] = Id("req"), ["applicationId"] = id, ["requestedBy"] = requestedBy, ["message"] = S(body, "message"), ["status"] = "PENDING", ["createdAt"] = Now() };
            Table(root, "infoRequests").Add(info); ChangeStatus(root, app, "ADDITIONAL_INFORMATION_REQUIRED", requestedBy, $"Əlavə məlumat tələb olunur: {S(body, "message")}", "NONE", null);
            return Results.Json(info.DeepClone(), statusCode: 201);
        }));

        api.MapGet("/admin/analytics", (HttpRequest request, LegacyDatabase db) => db.Read(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            var apps = Table(root, "applications").OfType<JsonObject>().Select(x => PopulateApplication(root, x)).ToList();
            var total = apps.Sum(x => N(x, "proposedInvestmentAmount"));
            return Results.Json(new
            {
                totalApplications = apps.Count,
                activeCompetitions = Table(root, "competitions").OfType<JsonObject>().Count(x => S(x, "status") == "ACTIVE"),
                publishedLands = Table(root, "lands").OfType<JsonObject>().Count(x => S(x, "status") == "PUBLISHED"),
                underReviewApplications = apps.Count(x => S(x, "status") == "UNDER_REVIEW"),
                decidedApplications = apps.Count(x => S(x, "status") == "DECIDED"),
                approvedApplications = apps.Count(x => S(x, "decisionOutcome") == "APPROVED"),
                rejectedApplications = apps.Count(x => S(x, "decisionOutcome") == "REJECTED"),
                totalProposedInvestment = total, averageProcessingDays = 4.8,
                applicationsByRegion = apps.GroupBy(x => S(x["land"] as JsonObject, "region") is { Length: > 0 } r ? r : "Digər").Select(g => new { region = g.Key, count = g.Count(), investment = g.Sum(x => N(x, "proposedInvestmentAmount")) }),
                applicationsBySector = apps.GroupBy(x => S(x["land"] as JsonObject, "agricultureType") is { Length: > 0 } s ? s : "Digər").Select(g => new { sector = g.Key, count = g.Count() }),
                applicationsByStatus = new[] { new { status = "RECEIVED", label = "Qəbul edilib", count = apps.Count(x => S(x, "status") == "RECEIVED") }, new { status = "UNDER_REVIEW", label = "Baxılır", count = apps.Count(x => S(x, "status") == "UNDER_REVIEW") }, new { status = "ADDITIONAL_INFORMATION_REQUIRED", label = "Əlavə məlumat tələb olunur", count = apps.Count(x => S(x, "status") == "ADDITIONAL_INFORMATION_REQUIRED") }, new { status = "DECIDED", label = "Qərar verilib", count = apps.Count(x => S(x, "status") == "DECIDED") } },
                timeline = new[] { new { month = "Yanvar 2026", applications = 2, investment = 740000d }, new { month = "Fevral 2026", applications = 5, investment = 2100000d }, new { month = "Mart 2026", applications = 4, investment = 1680000d }, new { month = "Aprel 2026", applications = apps.Count, investment = total } }
            });
        }));

        api.MapPost("/admin/integrations/ektis/sync", (JsonObject body, HttpRequest request, LegacyDatabase db) => db.Write(root =>
        {
            if (!IsAdmin(request, root)) return Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.");
            var token = $"EKTIS-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString()[^8..]}";
            var payload = new JsonObject { ["status"] = 200, ["syncToken"] = token, ["systemName"] = "Elektron Kənd Təsərrüfatı İnformasiya Sistemi (EKTİS)", ["message"] = "EKTİS sinxronizasiyası uğurla tamamlandı." };
            var log = new JsonObject { ["id"] = Id("log"), ["integrationType"] = $"EKTIS_{S(body, "syncType")}", ["status"] = "SUCCESS", ["requestPayload"] = body.DeepClone(), ["responsePayload"] = payload.DeepClone(), ["createdAt"] = Now() };
            Table(root, "integrationLogs").Insert(0, log);
            return Results.Json(new JsonObject { ["message"] = "EKTİS inteqrasiya sinxronizasiyası uğurla tamamlandı.", ["log"] = log.DeepClone(), ["response"] = payload });
        }));
        api.MapGet("/admin/integrations/ektis/logs", (HttpRequest request, LegacyDatabase db) => db.Read(root =>
            !IsAdmin(request, root) ? Error(403, "Bu əməliyyat üçün inzibatçı hüququ tələb olunur.") : Results.Json(CloneArray(Table(root, "integrationLogs").OfType<JsonObject>().OrderByDescending(x => S(x, "createdAt"))))));
    }

    private static void MapRecommendations(RouteGroupBuilder api) => api.MapPost("/recommendations", (JsonObject body, LegacyDatabase db) => db.Read(root =>
    {
        var results = new List<JsonObject>();
        foreach (var comp in Table(root, "competitions").OfType<JsonObject>().Where(x => S(x, "status") == "ACTIVE"))
        {
            var land = FindById(root, "lands", S(comp, "landId")); if (land is null || S(land, "status") != "PUBLISHED") continue;
            var location = string.IsNullOrWhiteSpace(S(body, "region")) ? 70 : S(land, "region").Equals(S(body, "region"), StringComparison.OrdinalIgnoreCase) ? 100 : 20;
            var sector = string.IsNullOrWhiteSpace(S(body, "agricultureType")) ? 70 : S(land, "agricultureType").Equals(S(body, "agricultureType"), StringComparison.OrdinalIgnoreCase) ? 100 : 15;
            var budget = 70; if (N(body, "budget") > 0) { var ratio = N(body, "budget") / Math.Max(1, N(land, "estimatedInvestmentRequirement")); budget = ratio is >= .9 and <= 1.5 ? 100 : ratio is >= .7 and < .9 ? 75 : ratio > 1.5 ? 85 : 30; }
            var area = 70; if (N(body, "minArea") > 0) { var ratio = N(land, "areaHectares") / N(body, "minArea"); area = ratio is >= .8 and <= 2.5 ? 100 : ratio > 2.5 ? 70 : 35; }
            var score = (int)Math.Round(location * .35 + budget * .30 + sector * .20 + area * .15);
            results.Add(new JsonObject { ["land"] = land.DeepClone(), ["competition"] = Competition(root, comp), ["matchScore"] = score, ["matchBreakdown"] = new JsonObject { ["locationScore"] = location, ["budgetScore"] = budget, ["sectorScore"] = sector, ["areaScore"] = area }, ["explanation"] = score >= 80 ? "Bu layihə parametrlərinizlə yüksək səviyyədə uzlaşır." : score >= 60 ? "Layihə əsas parametrlərinizlə uyğunluq təşkil edir." : "Layihənin bəzi şərtləri profilinizdən fərqlənir.", ["matchingFactors"] = new JsonArray(), ["mismatches"] = new JsonArray() });
        }
        return Results.Json(CloneArray(results.OrderByDescending(x => N(x, "matchScore"))));
    }));

    // MapAssistant (AgroKöməkçi + Gemini) lives in LegacyApiEndpoints.Assistant.cs

    private static string CreateSession(string userId, HttpResponse response)
    {
        var token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        Sessions[token] = new Session(userId, DateTimeOffset.UtcNow.Add(SessionLifetime));
        response.Cookies.Append("agroinvest_session", token, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = false, MaxAge = SessionLifetime });
        return token;
    }
    private static string? Token(HttpRequest request) => request.Headers.Authorization.ToString() is { } h && h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? h[7..].Trim() : request.Cookies["agroinvest_session"];
    private static string? UserId(HttpRequest request) => Token(request) is { } token && Sessions.TryGetValue(token, out var s) && s.ExpiresAt > DateTimeOffset.UtcNow ? s.UserId : null;
    private static JsonObject? CurrentUser(HttpRequest request, JsonObject root) => UserId(request) is { } id ? FindById(root, "users", id) : null;
    private static bool IsAdmin(HttpRequest request, JsonObject root) => S(CurrentUser(request, root), "role") == "ADMIN";
    private static IResult Error(int status, string message) => Results.Json(new { error = message }, statusCode: status);
    private static JsonArray Table(JsonObject root, string name) => root[name] as JsonArray ?? throw new InvalidOperationException($"Missing table: {name}");
    private static JsonObject? FindById(JsonObject root, string table, string id) => Find(root, table, x => S(x, "id") == id);
    private static JsonObject? Find(JsonObject root, string table, Func<JsonObject, bool> predicate) => Table(root, table).OfType<JsonObject>().FirstOrDefault(predicate);
    private static string S(JsonObject? item, string name) => item?[name]?.GetValue<string>() ?? string.Empty;
    private static double N(JsonObject? item, string name) => item?[name] is JsonValue value && value.TryGetValue<double>(out var number) ? number : double.TryParse(item?[name]?.ToString(), CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
    private static string Now() => DateTimeOffset.UtcNow.ToString("O");
    private static string Id(string prefix) => $"{prefix}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 20, prefix.Length + 2 + 32)];
    private static JsonObject SafeUser(JsonObject user) { var clone = (JsonObject)user.DeepClone(); clone.Remove("passwordHash"); return clone; }
    private static JsonArray CloneArray(IEnumerable<JsonObject> values) { var result = new JsonArray(); foreach (var value in values) result.Add(value.DeepClone()); return result; }
    private static void Merge(JsonObject target, JsonObject source) { foreach (var pair in source) target[pair.Key] = pair.Value?.DeepClone(); }
    private static void MergePresent(JsonObject target, JsonObject source, params string[] names) { foreach (var name in names) if (source.ContainsKey(name) && source[name] is not null) target[name] = source[name]!.DeepClone(); }
    private static IEnumerable<JsonObject> Filter(IEnumerable<JsonObject> items, IQueryCollection query, string queryName, string property) => !string.IsNullOrWhiteSpace(query[queryName]) && query[queryName] != "all" ? items.Where(x => S(x, property).Equals(query[queryName], StringComparison.OrdinalIgnoreCase)) : items;
    private static JsonObject Competition(JsonObject root, JsonObject comp) { var result = (JsonObject)comp.DeepClone(); result["land"] = FindById(root, "lands", S(comp, "landId"))?.DeepClone(); return result; }
    private static JsonObject PopulateApplication(JsonObject root, JsonObject app)
    {
        var result = (JsonObject)app.DeepClone(); var comp = FindById(root, "competitions", S(app, "competitionId"));
        result["user"] = FindById(root, "users", S(app, "userId")) is { } user ? SafeUser(user) : null;
        result["competition"] = comp is null ? null : Competition(root, comp); result["land"] = comp is null ? null : FindById(root, "lands", S(comp, "landId"))?.DeepClone();
        result["documents"] = CloneArray(Table(root, "documents").OfType<JsonObject>().Where(x => S(x, "applicationId") == S(app, "id")));
        result["statusHistory"] = CloneArray(Table(root, "statusHistory").OfType<JsonObject>().Where(x => S(x, "applicationId") == S(app, "id")).OrderBy(x => S(x, "createdAt")));
        result["infoRequests"] = CloneArray(Table(root, "infoRequests").OfType<JsonObject>().Where(x => S(x, "applicationId") == S(app, "id")));
        return result;
    }
    private static JsonObject AddDocument(JsonObject root, string appId, JsonObject body)
    {
        var doc = new JsonObject { ["id"] = Id("doc"), ["applicationId"] = appId, ["fileName"] = S(body, "fileName") is { Length: > 0 } n ? n : "Sened.pdf", ["storageKey"] = $"docs/{appId}/{S(body, "fileName")}", ["mimeType"] = S(body, "mimeType") is { Length: > 0 } m ? m : "application/pdf", ["fileSize"] = N(body, "fileSize") is > 0 and var size ? size : 1024000, ["fileData"] = body["fileData"]?.DeepClone(), ["uploadedAt"] = Now() };
        Table(root, "documents").Add(doc); return (JsonObject)doc.DeepClone();
    }
    private static void AddNotification(JsonObject root, string userId, string title, string message) => Table(root, "notifications").Insert(0, new JsonObject { ["id"] = Id("notif"), ["userId"] = userId, ["title"] = title, ["message"] = message, ["isRead"] = false, ["createdAt"] = Now() });
    private static void ChangeStatus(JsonObject root, JsonObject app, string status, string changedBy, string comment, string outcome, string? note)
    {
        var previous = S(app, "status"); app["status"] = status; if (status == "DECIDED") app["decisionOutcome"] = outcome; if (!string.IsNullOrWhiteSpace(note)) app["adminDecisionNote"] = note; app["updatedAt"] = Now();
        Table(root, "statusHistory").Add(new JsonObject { ["id"] = Id("hist"), ["applicationId"] = S(app, "id"), ["previousStatus"] = previous, ["newStatus"] = status, ["changedBy"] = changedBy, ["comment"] = comment, ["createdAt"] = Now() });
        AddNotification(root, S(app, "userId"), "Müraciət statusunuz yeniləndi", $"{S(app, "referenceNumber")} nömrəli müraciətinizin yeni statusu: {status}.");
    }
    private sealed record Session(string UserId, DateTimeOffset ExpiresAt);
}
