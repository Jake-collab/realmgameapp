import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro, creatorStyles } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
export default function Details() {
  const { draftId } = useLocalSearchParams<{ draftId:string }>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  if (c.query.isLoading) return <ActivityIndicator style={{ flex:1 }} color={colors.primary}/>;
  if (!c.draft) return <View style={{flex:1,justifyContent:'center',padding:24}}><Text>Draft unavailable.</Text></View>;
  return <CreatorStepLayout step="details" draftId={id} saveState={c.saveState}>
    <SectionIntro title="Give your Hunt a point of view" body="A clear promise helps players decide if this adventure is for them." />
    <Input label="Title" value={c.payload.title} onChangeText={title=>c.setPayload({...c.payload,title})} placeholder="Saturday market mystery" maxLength={120} style={creatorStyles.field as any}/>
    <Input label="Short summary" value={c.payload.summary} onChangeText={summary=>c.setPayload({...c.payload,summary})} placeholder="A playful trail through the market" maxLength={180} multiline />
    <Input label="Description" value={c.payload.description} onChangeText={description=>c.setPayload({...c.payload,description})} placeholder="Tell players what they will discover…" multiline numberOfLines={5} />
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:16}]}>Difficulty</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>{(['very_easy','easy','medium','hard','epic'] as const).map(v=><Button key={v} size="sm" variant={c.payload.difficulty===v?'primary':'outline'} onPress={()=>c.setPayload({...c.payload,difficulty:v})}>{v.replace('_',' ')}</Button>)}</View>
    <Input label="Estimated minutes" keyboardType="number-pad" value={String(c.payload.estimatedDurationMinutes)} onChangeText={v=>c.setPayload({...c.payload,estimatedDurationMinutes:Math.max(5,Number(v)||0)})}/>
    <CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/privacy`)} />
  </CreatorStepLayout>;
}