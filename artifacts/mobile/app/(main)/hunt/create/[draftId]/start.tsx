import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
export default function StartArea() {
  const {draftId}=useLocalSearchParams<{draftId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  const area=c.payload.publicStartingArea ?? {label:'',latitude:null,longitude:null,radiusMeters:100,confirmed:false};
  const setArea=(patch:Partial<typeof area>)=>c.setPayload({...c.payload,publicStartingArea:{...area,...patch}});
  return <CreatorStepLayout step="start" draftId={id} saveState={c.saveState}><SectionIntro title="Choose a safe starting area" body="Search and map editing can be connected to the shared Mapbox picker. For now, confirm a public landmark with an approximate point — never use your current location automatically."/>
    <Input label="Public location label" value={area.label} onChangeText={label=>setArea({label})} placeholder="Main library entrance"/>
    <Input label="Latitude" keyboardType="decimal-pad" value={area.latitude===null?'':String(area.latitude)} onChangeText={v=>setArea({latitude:Number(v)})} placeholder="Map-selected latitude"/>
    <Input label="Longitude" keyboardType="decimal-pad" value={area.longitude===null?'':String(area.longitude)} onChangeText={v=>setArea({longitude:Number(v)})} placeholder="Map-selected longitude"/>
    <Button fullWidth variant={area.confirmed?'primary':'outline'} onPress={()=>setArea({confirmed:!area.confirmed})}>{area.confirmed?'✓ Location confirmed':'Confirm public location'}</Button>
    <Input label="Meeting instructions (optional)" value={c.payload.publicMeetingInfo} onChangeText={publicMeetingInfo=>c.setPayload({...c.payload,publicMeetingInfo})} multiline placeholder="Meet near the public entrance…" />
    <CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/stops`)} />
  </CreatorStepLayout>;
}