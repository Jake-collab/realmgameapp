import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro, creatorStyles } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
import type { HuntRevealMode } from '@/features/hunts/types/creator.types';

const revealModes: Array<[HuntRevealMode, string, string]> = [
  ['ALWAYS_VISIBLE', 'Always visible', 'Keep this Hunt simple.'],
  ['HUNT_START_REVEAL', 'At Hunt start', 'Reveal all objectives when the player begins.'],
  ['PREREQUISITE_REVEAL', 'Prerequisites', 'Reveal objectives after earlier stops are complete.'],
  ['PROXIMITY_REVEAL', 'Proximity', 'Reveal an objective when the player enters its radius.'],
  ['ZONE_REVEAL', 'Zone unlock', 'Reveal objectives when their zone becomes available.'],
  ['CLUE_ONLY', 'Clue only', 'Show a clue without exposing an exact map marker.'],
  ['MANUAL_ADMIN_REVEAL', 'Manual / admin', 'Keep the objective hidden until authorized.'],
];

export default function Privacy() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const id = String(draftId);
  const c = useCreatorDraftEditor(id);
  const colors = useColors();
  const [zoneName, setZoneName] = useState('');
  const options = [
    ['public', 'Public', 'Can appear on the map after approval.'],
    ['unlisted', 'Unlisted', 'Accessible with a direct link.'],
    ['invite_only', 'Invite only', 'Only invited players can access it.'],
    ['private', 'Private', 'Only explicitly authorized players can access it.'],
  ] as const;

  const addZone = () => {
    const name = zoneName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `zone-${c.payload.zones.length + 1}`;
    if (c.payload.zones.some(zone => zone.key === key)) return;
    c.setPayload({
      ...c.payload,
      zones: [...c.payload.zones, {
        key,
        name,
        sortOrder: c.payload.zones.length,
        required: true,
        prerequisiteZoneKeys: [],
        publicCenterLat: null,
        publicCenterLng: null,
        publicRadiusMeters: 500,
      }],
    });
    setZoneName('');
  };

  return (
    <CreatorStepLayout step="privacy" draftId={id} saveState={c.saveState}>
      <SectionIntro title="Set the rules" body="Choose who can find your Hunt and how players will participate." />
      <Text style={[creatorStyles.label, { color: colors.foreground }]}>Privacy</Text>
      {options.map(([value, label, description]) => (
        <Button key={value} fullWidth variant={c.payload.privacy === value ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, privacy: value })}>
          {label} · {description}
        </Button>
      ))}

      <Text style={[creatorStyles.label, { color: colors.foreground, marginTop: 20 }]}>Participation</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(['solo', 'group', 'solo_or_group'] as const).map(value => (
          <Button key={value} variant={c.payload.participationMode === value ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, participationMode: value })}>
            {value === 'solo' ? 'Solo' : value === 'group' ? 'Group' : 'Solo or group'}
          </Button>
        ))}
      </View>
      <Text style={[creatorStyles.label, { color: colors.foreground, marginTop: 20 }]}>Progression</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['ordered', 'unordered'] as const).map(value => (
          <Button key={value} variant={c.payload.stopOrdering === value ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, stopOrdering: value })}>
            {value === 'ordered' ? 'In order' : 'Any order'}
          </Button>
        ))}
      </View>
      <Input label="Maximum participants" keyboardType="number-pad" value={String(c.payload.maxParticipants)} onChangeText={value => c.setPayload({ ...c.payload, maxParticipants: Math.min(500, Math.max(1, Number(value) || 1)) })} />

      <Text style={[creatorStyles.label, { color: colors.foreground, marginTop: 20 }]}>Advanced world rules</Text>
      <Text style={{ color: colors.mutedForeground, lineHeight: 19 }}>
        These are optional. A simple Hunt stays simple; advanced rules only affect objectives that use them.
      </Text>
      <Text style={[creatorStyles.label, { color: colors.foreground, marginTop: 12 }]}>Default reveal behavior</Text>
      {revealModes.map(([value, label, description]) => (
        <Button key={value} fullWidth variant={c.payload.defaultRevealMode === value ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, defaultRevealMode: value })}>
          {label} · {description}
        </Button>
      ))}
      <Input
        label="Default reveal radius (meters)"
        keyboardType="number-pad"
        value={String(c.payload.defaultRevealRadiusMeters)}
        onChangeText={value => c.setPayload({ ...c.payload, defaultRevealRadiusMeters: Math.min(5000, Math.max(25, Number(value) || 25)) })}
      />
      <Button fullWidth variant={c.payload.fogOfWarEnabled ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, fogOfWarEnabled: !c.payload.fogOfWarEnabled })}>
        {c.payload.fogOfWarEnabled ? 'Fog of war enabled' : 'Enable fog of war'}
      </Button>
      <Button fullWidth variant={c.payload.persistentExploration ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, persistentExploration: !c.payload.persistentExploration })}>
        {c.payload.persistentExploration ? 'Persistent exploration enabled' : 'Persist exploration across devices'}
      </Button>
      <Button fullWidth variant={c.payload.trailEnabled ? 'primary' : 'outline'} onPress={() => c.setPayload({ ...c.payload, trailEnabled: !c.payload.trailEnabled })}>
        {c.payload.trailEnabled ? 'Local activity trail enabled' : 'Allow local activity trail'}
      </Button>

      <Text style={[creatorStyles.label, { color: colors.foreground, marginTop: 20 }]}>Zones</Text>
      <Text style={{ color: colors.mutedForeground, lineHeight: 19 }}>Optional areas can unlock in sequence and report their own progress.</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input label="New zone name" value={zoneName} onChangeText={setZoneName} placeholder="Waterfront" />
        </View>
        <Button onPress={addZone}>Add</Button>
      </View>
      {c.payload.zones.map(zone => (
        <View key={zone.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text style={{ color: colors.foreground, flex: 1 }}>{zone.sortOrder + 1}. {zone.name}</Text>
          <Button size="sm" variant="outline" onPress={() => c.setPayload({ ...c.payload, zones: c.payload.zones.filter(item => item.key !== zone.key) })}>Remove</Button>
        </View>
      ))}
      <CreatorNext onPress={() => router.push(`/(main)/hunt/create/${id}/schedule`)} />
    </CreatorStepLayout>
  );
}