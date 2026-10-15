import { backend } from './backend';
import { db, mutate } from './db';
import type { InvestmentRequest } from '../types/agro';
import { toLand, type BackendLand } from './ministryLands';

interface ProposalRow {
  id: string; userId: string; opportunityId: string; proposedInvestmentAmount: number;
  businessPlanSummary: string; estimatedImplementationPeriod: string;
  status: string; submittedAt: string; updatedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  opportunity: { landId: string; status: string } | null;
  land: BackendLand | null;
}

function mapStatus(status: string): InvestmentRequest['status'] {
  switch (status) {
    case 'SELECTED': return 'selected';
    case 'OPEN': return 'pending';
    case 'REJECTED': return 'rejected';
    case 'CANCELLED': return 'cancelled';
    default: return 'notSelected';
  }
}

export async function syncPortalProposals(): Promise<void> {
  const [sent, received] = await Promise.all([
    backend<ProposalRow[]>('GET', '/proposals/sent'),
    backend<ProposalRow[]>('GET', '/proposals/received'),
  ]);
  const rows = [...new Map([...sent, ...received].map(p => [p.id, p])).values()];
  const serverIds = new Set(rows.map(p => p.id));
  mutate(d => {
    d.requests = d.requests.filter(r => !serverIds.has(r.id) && !d.lands.some(l => l.id === r.landId && l.source));
    for (const p of rows) {
      const landId = p.opportunity?.landId;
      if (!landId) continue;
      if (p.land && !d.lands.some(l => l.id === landId)) {
        const land = toLand(p.land);
        land.status = p.status === 'SELECTED' ? 'funded' : p.opportunity?.status === 'ACTIVE' ? 'active' : 'closed';
        d.lands.push(land);
      }
      if (p.user && !d.users.some(u => u.id === p.user!.id)) {
        d.users.push({ id: p.user.id, fullName: `${p.user.firstName} ${p.user.lastName}`.trim(), email: p.user.email,
          phone: '', avatar: null, roles: [], verified: false, isAdmin: false,
          preferences: { budgetMin: 0, budgetMax: 0, fieldTypes: [], regions: [], riskTolerance: 'medium' } });
      }
      d.requests.push({ id: p.id, landId, investorId: p.userId, amount: Number(p.proposedInvestmentAmount),
        investmentModel: 'lease', durationMonths: Number.parseInt(p.estimatedImplementationPeriod, 10) || 0,
        message: p.businessPlanSummary, status: mapStatus(p.status), viewedByOwner: false, source: 'portal',
        createdAt: p.submittedAt, updatedAt: p.updatedAt });
    }
  });
}

export function isPortalRequest(landId: string): boolean { return !!db().lands.find(l => l.id === landId)?.source; }
