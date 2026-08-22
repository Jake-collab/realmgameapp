import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
export default function Preview() {
  const {draftId}=useLocalSearchParams<{draftId:string}>();const id=String(draftId);const c=useCreatorDraftEditor(id);const colors=useColors();
  return <CreatorStepLayout step="preview" draftId={id} saveState={c.saveState}><SectionIntro title="Preview as a player" body="This preview intentionally hides private answers and exact validation geometry. It never creates participation or awards points."/>
    <View style={{padding:20,borderRadius:16,backgroundColor:colors.card,borderWidth:1,borderColor:colors.border}}><Text style={{fontSize:26,fontWeight:'700',color:colors.foreground}}>{c.payload.title||'Untitled Hunt'}</Text><Text style={{color:colors.mutedForeground,marginTop:8}}>{c.payload.summary||'Add a summary in Details.'}</Text><Text style={{color:colors.foreground,marginTop:18,lineHeight:22}}>{c.payload.description||'Your description will appear here.'}</Text><Text style={{color:colors.mutedForeground,marginTop:18}}>{c.payload.stops.length} stops · {c.payload.stopOrdering==='ordered'?'In order':'Any order'} · {c.payload.privacy.replace('_',' ')}</Text><Text style={{color:colors.mutedForeground,marginTop:10}}>Safety and accessibility notes will be shown to players.</Text></View>
    <Button fullWidth variant="outline" onPress={()=>router.push(`/(main)/hunt/create/${id}/review`)}>Creator structure preview</Button><CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/review`)} /></CreatorStepLayout>;
}