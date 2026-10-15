import assert from 'node:assert/strict';
import test from 'node:test';
import { canAdminApplicationAction, missingRequiredDocuments, parseDocumentRequirements, requirementsForApplicant } from '../src/features/rentals/rental-workflow.ts';

const profile = (applicantType, foreignKind = null) => ({ applicantType, foreignKind });
const requirement = (applicantScope, kind, isRequired = true) => ({ applicantScope, kind, label: kind, isRequired });

test('applicant document requirements follow the selected individual or entity subtype', () => {
  const rules = [requirement('ALL', 'policy'), requirement('INDIVIDUAL', 'identity'), requirement('LEGAL_ENTITY', 'registry'), requirement('FOREIGN_INDIVIDUAL', 'passport'), requirement('FOREIGN_LEGAL_ENTITY', 'authority')];

  assert.deepEqual(requirementsForApplicant(rules, profile('INDIVIDUAL')).map(x => x.kind), ['policy', 'identity']);
  assert.deepEqual(requirementsForApplicant(rules, profile('LEGAL_ENTITY')).map(x => x.kind), ['policy', 'registry']);
  assert.deepEqual(requirementsForApplicant(rules, profile('FOREIGN_APPLICANT', 'INDIVIDUAL')).map(x => x.kind), ['policy', 'passport']);
  assert.deepEqual(requirementsForApplicant(rules, profile('FOREIGN_APPLICANT', 'LEGAL_ENTITY')).map(x => x.kind), ['policy', 'authority']);
});

test('subtype rules override a general rule for the same document kind and optional files are not submission blockers', () => {
  const rules = [requirement('ALL', 'registration', true), requirement('FOREIGN_LEGAL_ENTITY', 'registration', false), requirement('ALL', 'plan', true)];
  const applicable = requirementsForApplicant(rules, profile('FOREIGN_APPLICANT', 'LEGAL_ENTITY'));

  assert.equal(applicable.find(x => x.kind === 'registration').isRequired, false);
  assert.deepEqual(missingRequiredDocuments(applicable, [] ).map(x => x.kind), ['plan']);
  assert.deepEqual(missingRequiredDocuments(applicable, ['PLAN']), []);
});

test('admin listing and application actions are gated by the workflow status', () => {
  assert.equal(canAdminApplicationAction('SUBMITTED', 'start-review'), true);
  assert.equal(canAdminApplicationAction('SUBMITTED', 'approve'), false);
  assert.equal(canAdminApplicationAction('UNDER_REVIEW', 'request-information'), true);
  assert.equal(canAdminApplicationAction('UNDER_REVIEW', 'approve'), true);
  assert.equal(canAdminApplicationAction('UNDER_REVIEW', 'finalize-lease'), false);
  assert.equal(canAdminApplicationAction('APPROVED', 'finalize-lease'), true);
  assert.equal(canAdminApplicationAction('REJECTED', 'approve'), false);
});

test('admin listing document-rule editor parses and normalizes scoped required and optional rules', () => {
  assert.deepEqual(parseDocumentRequirements(' foreign_individual | passport | Passport copy | required\nALL|plan|Use plan|optional'), [
    { applicantScope: 'FOREIGN_INDIVIDUAL', kind: 'passport', label: 'Passport copy', isRequired: true },
    { applicantScope: 'ALL', kind: 'plan', label: 'Use plan', isRequired: false },
  ]);
});
