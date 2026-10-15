# Land use: 25 types, required data and deal-breakers

Code: `src/QarabagInvestmentPortal.Api/Features/Lands/`

| File | What it does |
| --- | --- |
| `LandUseCatalog.cs` | The 25 types (keys match `frontend/src/data/categories.ts`), their specific inputs and deal-breakers. Thresholds live here. |
| `LandProfile.cs` | Reads and validates the land data (common core + type-specific inputs, boundary polygon). |
| `LandSuitability.cs` | Checks in order: 1) legal category / convertibility, 2) the type's deal-breakers, 3) missing data. |

## Data on a land

- `LandUse` — catalog key (`crops`, `greenhouse`, …). `AgricultureType` keeps the Azerbaijani name.
- Common core (all types): `CadastralNumber`, `LegalCategory`, `CategoryConvertible`, `OwnershipForm` (private / municipal / state; not the same as the ministry's `OwnershipType` Private/State),
  `HasEncumbrance`, `Encumbrances`, `BoundaryGeoJson` (GeoJSON Polygon, jsonb), `RoadAccessType`,
  `RoadDistanceKm`, `SettlementDistanceKm`, `CurrentUse`, photos (`land_photos`).
- Type-specific inputs: `Attributes` (jsonb object, keys from the catalog).

Everything except the type is optional when submitting. Deal-breakers **warn** (the admin decides):
the result is shown on every land (`suitability`), unsuitable lands come first in the admin review queue,
and they are never recommended.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/land-uses` | Catalog for the form: core fields, choices, 25 types with inputs and deal-breakers |
| GET | `/api/land-uses/{key}` | One type |
| POST | `/api/land-uses/check?photos=N` | Check data before submitting (JSON body, nothing saved) |
| POST | `/api/my/lands` | Submit (multipart). New fields: `landUse` (or `agricultureType`), `cadastralNumber`, `legalCategory`, `categoryConvertible`, `ownershipForm`, `hasEncumbrance`, `encumbrances`, `boundary` (JSON), `roadAccessType`, `roadDistanceKm`, `settlementDistanceKm`, `currentUse`, `attributes` (JSON object), files `photos` |
| POST | `/api/my/lands/{id}/profile` | Owner fills in / corrects the data later, may add photos |
| GET | `/api/lands/{landId}/photos/{photoId}` | Photo (public once the land is approved) |

`suitability.level`: `SUITABLE`, `NEEDS_DATA` or `UNSUITABLE`, with `dealBreakers`, `warnings`, `missing`,
`unchecked` and `completeness` (%).

Not yet: filling slope, sun, flood risk etc. automatically from satellite/map data.
