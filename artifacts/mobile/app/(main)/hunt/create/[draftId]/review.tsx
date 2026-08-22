import React from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { CreatorStepLayout, SectionIntro } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useSubmitHuntForReview, useValidateHuntDraft } from '@/features/hunts/hooks/creatorHooks';
import { validateCreatorDraft } from '@/features/hunts/types/creator.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
export default function Review() {
  const {draftId}=useLocalSearchParams<{draftId:string}>();const id=String(draftId);const c=useCreatorDraftEditor(id);const colors=useColors();const {user}=useAuth();const validate=useValidateHuntDraft();const submit=useSubmitHuntForReview(user?.id??null);const local=validateCreatorDraft(c.payload);
  const run=()=>validate.mutate(id,{onSuccess:r=>{if(!r.valid){Alert.alert('Finish a few steps',r.issues.map(i=>i.message).join('\n'));return;}submit.mutate(id,{onSuccess:()=>Alert.alert('Submitted','Your Hunt is now pending review.',[{text:'Back to My Hunts',onPress:()=>router.replace('/(main)/hunt/my-hunts')}]),onError:()=>Alert.alert('Unable to submit','Please try again when you are online.')})},onError:()=>{if(!local.valid)Alert.alert('Finish a few steps',local.issues.map(i=>i.message).join('\n'));else Alert.alert('Unable to validate','Please try again when you are online.')}}); 
  if (c.query.isLoading) return <ActivityIndicator style={{flex:1}} color={colors.primary}/>;
  return <CreatorStepLayout step="review" draftId={id} saveState={c.saveState}><SectionIntro title="Ready to share?" body="Review the basics before sending your Hunt to human moderation. Approval is required before it can be published."/>
    <View style={{gap:12}}><Text style={{color:colors.foreground,fontSize:20,fontWeight:'700'}}>{c.payload.title||'Untitled Hunt'}</Text><Text style={{color:colors.mutedForeground}}>{c.payload.stops.length} stops · {c.payload.pointsRequested} requested points · {c.payload.maxParticipants} max players</Text><Text style={{color:colors.mutedForeground}}>Privacy: {c.payload.privacy.replace('_',' ')} · {c.payload.startModel.replace('_',' ')}</Text></View>
    {local.issues.length>0&&<View style={{padding:16,backgroundColor:colors.destructive+'12',borderRadius:12}}><Text style={{color:colors.destructive,fontWeight:'700'}}>Needs attention</Text>{local.issues.map(issue=><Text key={issue.code} style={{color:colors.destructive,marginTop:6}}>• {issue.message}</Text>)}</View>}
    <Button fullWidth variant="outline" onPress={()=>router.push(`/(main)/hunt/create/${id}/details`)}>Edit details</Button><Button fullWidth loading={validate.isPending||submit.isPending} disabled={c.draft?.status==='pending_review'} onPress={run}>{c.draft?.status==='pending_review'?'Pending review':'Submit for review'}</Button>
  </CreatorStepLayout>;
}