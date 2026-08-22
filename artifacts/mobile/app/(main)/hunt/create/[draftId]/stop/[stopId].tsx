import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro, creatorStyles } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
import type { CreatorStopType } from '@/features/hunts/types/creator.types';
export default function StopEditor() {
  const {draftId,stopId}=useLocalSearchParams<{draftId:string;stopId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  const index=c.payload.stops.findIndex(s=>s.id===stopId); const stop=c.payload.stops[index];
  if (!stop) return <View style={{flex:1,justifyContent:'center',padding:24}}><Text style={{color:colors.foreground}}>Stop unavailable.</Text></View>;
  const set=(patch:Partial<typeof stop>)=>c.setPayload({...c.payload,stops:c.payload.stops.map(s=>s.id===stop.id?{...s,...patch}:s)});
  return <CreatorStepLayout step="stops" draftId={id} saveState={c.saveState}><SectionIntro title={`Stop ${index+1}`} body="Keep this focused. Players should know what to do and how to complete it."/>
    <Input label="Stop title" value={stop.title} onChangeText={title=>set({title})} placeholder="Find the blue door"/>
    <Input label="Instructions" value={stop.instruction} onChangeText={instruction=>set({instruction})} multiline placeholder="Look for…"/>
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:12}]}>Stop type</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['location','activity','clue','mixed'] as CreatorStopType[]).map(v=><Button key={v} size="sm" variant={stop.type===v?'primary':'outline'} onPress={()=>set({type:v})}>{v}</Button>)}</View>
    <Button fullWidth variant={stop.required?'primary':'outline'} onPress={()=>set({required:!stop.required})}>{stop.required?'Required stop':'Optional stop'}</Button>
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:16}]}>Proof requirement</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['manual_confirmation','location','text','image','image_and_location','text_and_image'] as const).map(v=><Button key={v} size="sm" variant={stop.completionMethod===v?'primary':'outline'} onPress={()=>set({completionMethod:v})}>{v.replaceAll('_',' ')}</Button>)}</View>
    <Input label="Clue" value={stop.clueText} onChangeText={clueText=>set({clueText})} multiline placeholder="Your clue appears when this stop unlocks."/>
    <Input label="Hint (optional)" value={stop.hintText} onChangeText={hintText=>set({hintText})} multiline/>
    {stop.completionMethod==='text' && <Input label="Riddle answer (private)" secure value={stop.riddleAnswer} onChangeText={riddleAnswer=>set({riddleAnswer})} placeholder="Only trusted validation can use this"/>}
    <Input label="Safety note (optional)" value={stop.safetyNote} onChangeText={safetyNote=>set({safetyNote})} multiline/>
    <Input label="Accessibility note (optional)" value={stop.accessibilityNote} onChangeText={accessibilityNote=>set({accessibilityNote})} multiline/>
    <CreatorNext label="Save stop" onPress={()=>router.back()}/></CreatorStepLayout>;
}