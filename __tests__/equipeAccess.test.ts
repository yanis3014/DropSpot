import { describe, expect, it } from 'vitest';
import {
  canManageTeam,
  roleHasCapability,
  TEAM_CAPABILITY_MATRIX,
  TEAM_ROLE_LABELS,
} from '@/lib/pro/navAccess';
import { teamErrorMessage } from '@/app/(pro)/dashboard-pro/lib/api/team';

describe('TEAM_CAPABILITY_MATRIX', () => {
  it('aligne la maquette Qui peut faire quoi', () => {
    expect(TEAM_CAPABILITY_MATRIX).toHaveLength(6);
    expect(TEAM_ROLE_LABELS.owner).toBe('Gérant·e');
    expect(TEAM_ROLE_LABELS.manager).toBe('Responsable');
    expect(TEAM_ROLE_LABELS.staff).toBe('Équipier·e');

    expect(roleHasCapability('staff', 'validate_drop')).toBe(true);
    expect(roleHasCapability('staff', 'manage_drops')).toBe(false);
    expect(roleHasCapability('manager', 'manage_drops')).toBe(true);
    expect(roleHasCapability('manager', 'edit_place')).toBe(false);
    expect(roleHasCapability('owner', 'team_and_billing')).toBe(true);
    expect(roleHasCapability('staff', 'team_and_billing')).toBe(false);
  });
});

describe('canManageTeam', () => {
  it('masque les actions d’admin pour manager et staff', () => {
    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('manager')).toBe(false);
    expect(canManageTeam('staff')).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });
});

describe('teamErrorMessage last_owner', () => {
  it('affiche le message dernier gérant', () => {
    expect(teamErrorMessage('last_owner')).toMatch(/dernier gérant/i);
  });
});
