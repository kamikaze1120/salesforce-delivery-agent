import {assert} from './core.mjs';
import {metadataInventory} from './metadata-inventory.mjs';
import {compareMetadataBaselines} from './metadata-drift.mjs';

// Never reuse the plan-time snapshot as the supposed current observation.
// This gate is for direct, non-production sandbox operations. Protected CI
// promotions require their own signed pre-write check.
export async function verifyDirectMetadataDrift(approvedContext, brd, request, currentOrgId) {
 assert(approvedContext?.org?.id && approvedContext.org.id === currentOrgId,
  'The current Salesforce organization differs from the reviewed baseline.',409);
 assert(typeof brd === 'string' && brd.length > 0,'A saved BRD is required for drift verification.',409);
 const current=await metadataInventory(request,brd);
 const result=compareMetadataBaselines(approvedContext,current);
 const report={...result,checkedAt:new Date().toISOString(),orgId:currentOrgId,scope:'Direct sandbox check; bounded inventory only'};
 return report;
}

export function requireNoDirectDrift(report) {
 assert(report && report.blocking === false,
  'Salesforce metadata changed or could not be verified. Reanalyze the BRD and obtain fresh approvals before validation or deployment.',409);
 return report;
}
