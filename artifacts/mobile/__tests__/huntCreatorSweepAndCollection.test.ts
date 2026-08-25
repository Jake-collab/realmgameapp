import fs from 'node:fs';
import path from 'node:path';

declare const describe: (name: string, run: () => void) => void;
declare const it: (name: string, run: () => void) => void;
declare const expect: any;

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/048_hunt_creator_live_sweep_and_revision_guard.sql'),
  'utf8',
);
const collectionHook = fs.readFileSync(
  path.join(process.cwd(), 'features/hunts/hooks/useCollectHuntDrop.ts'),
  'utf8',
);

describe('Hunt creator live sweep and Drop collection guards', () => {
  it('requires a short-lived camera sweep session tied to stop and Hunt version', () => {
    expect(migration).toContain('hunt_creator_stop_sweep_sessions');
    expect(migration).toContain("INTERVAL '5 minutes'");
    expect(migration).toContain('hunt_version');
    expect(migration).toContain("purpose = 'hunt_creator_sweep'");
    expect(migration).toContain('live_camera_sweep_required_for_proof_stop');
    expect(migration).not.toContain('qr_code');
  });

  it('keeps SQL authoritative and suppresses rapid duplicate client collection calls', () => {
    expect(collectionHook).toContain('collectingStopIds');
    expect(collectionHook).toContain('Collection is already in progress');
    expect(collectionHook).toContain('finally');
    expect(collectionHook).toContain('mutateAsync(stopId)');
  });
});