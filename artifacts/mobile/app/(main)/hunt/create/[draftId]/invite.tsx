import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useColors } from '@/hooks/useColors';
export default function InviteFriends() {
  const {draftId}=useLocalSearchParams<{draftId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors(); const friends=useFriends();
  const list=(friends.data ?? []) as any[];
  const toggle=(ref:string)=>c.setPayload({...c.payload,intendedInviteeIds:c.payload.intendedInviteeIds.includes(ref)?c.payload.intendedInviteeIds.filter(x=>x!==ref):[...c.payload.intendedInviteeIds,ref]});
  return <CreatorStepLayout step="invite" draftId={id} saveState={c.saveState}><SectionIntro title="Invite your people" body="These are intended invitees only. Nothing is sent until the Hunt is approved and invitations are rechecked."/>
    {c.payload.privacy==='public'||c.payload.privacy==='unlisted'?<Text style={{color:colors.mutedForeground}}>This Hunt can be discovered, so invitations are optional.</Text>:list.length===0?<Text style={{color:colors.mutedForeground}}>Your eligible friends will appear here. You can continue without selecting anyone.</Text>:list.map(friend=>{const ref=friend.publicUserRef ?? friend.username;const selected=c.payload.intendedInviteeIds.includes(ref);return <View key={ref} style={{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border}}><View style={{flex:1}}><Text style={{color:colors.foreground,fontWeight:'600'}}>{friend.displayName}</Text><Text style={{color:colors.mutedForeground}}>@{friend.username}</Text></View><Button size="sm" variant={selected?'primary':'outline'} onPress={()=>toggle(ref)}>{selected?'Selected':'Select'}</Button></View>})}
    <CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/preview`)} /></CreatorStepLayout>;
}