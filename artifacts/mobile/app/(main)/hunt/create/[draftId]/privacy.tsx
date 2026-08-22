import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro, creatorStyles } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
export default function Privacy() {
  const {draftId}=useLocalSearchParams<{draftId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  const options=[['public','Public','Can appear on the map after approval.'],['unlisted','Unlisted','Accessible with a direct link.'],['invite_only','Invite only','Only invited players can access it.'],['private','Private','Only explicitly authorized players can access it.']] as const;
  return <CreatorStepLayout step="privacy" draftId={id} saveState={c.saveState}><SectionIntro title="Set the rules" body="Choose who can find your Hunt and how players will participate."/>
    <Text style={[creatorStyles.label,{color:colors.foreground}]}>Privacy</Text>{options.map(([v,l,d])=><Button key={v} fullWidth variant={c.payload.privacy===v?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,privacy:v})}>{l} · {d}</Button>)}
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:20}]}>Participation</Text>{(['solo','group','solo_or_group'] as const).map(v=><Button key={v} fullWidth variant={c.payload.participationMode===v?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,participationMode:v})}>{v==='solo'?'Solo':v==='group'?'Group':'Solo or group'}</Button>)}
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:20}]}>Progression</Text><View style={{flexDirection:'row',gap:8}}>{(['ordered','unordered'] as const).map(v=><Button key={v} variant={c.payload.stopOrdering===v?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,stopOrdering:v})}>{v==='ordered'?'In order':'Any order'}</Button>)}</View>
    <Input label="Maximum participants" keyboardType="number-pad" value={String(c.payload.maxParticipants)} onChangeText={v=>c.setPayload({...c.payload,maxParticipants:Math.min(500,Math.max(1,Number(v)||1))})} />
    <CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/start`)} />
  </CreatorStepLayout>;
}