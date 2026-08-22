import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
export default function Schedule() {
  const {draftId}=useLocalSearchParams<{draftId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  return <CreatorStepLayout step="privacy" draftId={id} saveState={c.saveState}><SectionIntro title="Choose when it runs" body="Use your local timezone when entering times. Worlds stores the authoritative schedule in UTC."/>
    <Button fullWidth variant={c.payload.startModel==='individual'?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,startModel:'individual'})}>Start anytime</Button>
    <Button fullWidth variant={c.payload.startModel==='scheduled'?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,startModel:'scheduled'})}>Scheduled start</Button>
    <Input label="Start date and time (optional)" value={c.payload.startsAt ?? ''} onChangeText={startsAt=>c.setPayload({...c.payload,startsAt:startsAt||null})} placeholder="2026-09-12T10:00"/>
    <Input label="End date and time (optional)" value={c.payload.endsAt ?? ''} onChangeText={endsAt=>c.setPayload({...c.payload,endsAt:endsAt||null})} placeholder="2026-09-12T13:00"/>
    <Input label="Join deadline (optional)" value={c.payload.joinUntil ?? ''} onChangeText={joinUntil=>c.setPayload({...c.payload,joinUntil:joinUntil||null})} placeholder="2026-09-12T09:45"/>
    <Text style={{color:colors.mutedForeground,fontSize:12,marginTop:4}}>Format: YYYY-MM-DDTHH:mm. A native date picker can replace these fields when the shared picker is connected.</Text>
    <CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/start`)} /></CreatorStepLayout>;
}