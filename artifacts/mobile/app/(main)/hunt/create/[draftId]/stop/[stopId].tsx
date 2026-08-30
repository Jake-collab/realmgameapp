import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout, SectionIntro, creatorStyles } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { useColors } from '@/hooks/useColors';
import type { CreatorStopType } from '@/features/hunts/types/creator.types';
import * as ImagePicker from 'expo-image-picker';
import { acknowledgePaidCollectibleFee, beginCreatorStopSweep, configureHuntDropCommerce, uploadCreatorStopSweep } from '@/features/hunts/repositories/creator.repository';
import type { CollectibleRarity, CreatorStopCommerce } from '@/features/hunts/types/creator.types';

const EMPTY_COMMERCE: CreatorStopCommerce = {
  findLimit: null, collectibleName: '', collectibleDescription: '', priceMinor: 0, quantity: null,
};

function rarityForQuantity(quantity: number | null): CollectibleRarity {
  if (quantity === 1) return 'UNIQUE';
  if (quantity !== null && quantity <= 5) return 'LEGENDARY';
  if (quantity !== null && quantity <= 20) return 'EPIC';
  if (quantity !== null && quantity <= 50) return 'RARE';
  if (quantity !== null && quantity <= 100) return 'UNCOMMON';
  return 'COMMON';
}

export default function StopEditor() {
  const {draftId,stopId}=useLocalSearchParams<{draftId:string;stopId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  const index=c.payload.stops.findIndex(s=>s.id===stopId); const stop=c.payload.stops[index]; const [sweeping,setSweeping]=useState(false);
  const [paidFeeAcknowledged, setPaidFeeAcknowledged] = useState(false);
  if (!stop) return <View style={{flex:1,justifyContent:'center',padding:24}}><Text style={{color:colors.foreground}}>Stop unavailable.</Text></View>;
  const set=(patch:Partial<typeof stop>)=>c.setPayload({...c.payload,stops:c.payload.stops.map(s=>s.id===stop.id?{...s,...patch}:s)});
  const commerce = { ...EMPTY_COMMERCE, ...stop.commerce };
  const setCommerce = (patch: Partial<CreatorStopCommerce>) => set({ commerce: { ...commerce, ...patch } });
  const parseOptionalPositive = (value: string) => value.trim() === '' ? null : Number.parseInt(value.replace(/\D/g, ''), 10);
  const saveStop=async()=>{
    if(stop.id.startsWith('local-stop-')){Alert.alert('Save still in progress','Wait for this stop to receive its server ID, then save again.');return;}
    if(commerce.findLimit !== null && commerce.findLimit < 1){Alert.alert('Check find limit','Enter a positive find limit or leave it blank for unlimited.');return;}
    if(commerce.quantity !== null && commerce.quantity < 1){Alert.alert('Check quantity','Enter a positive quantity or leave it blank for unlimited.');return;}
    const name=commerce.collectibleName.trim();
    if(name && commerce.priceMinor > 0 && commerce.priceMinor < 100){Alert.alert('Check price','Paid collectibles must cost at least 100 cents. Use Free for a $0 collectible.');return;}
    if(name && commerce.priceMinor > 0 && !paidFeeAcknowledged){Alert.alert('Acknowledge the platform fee','Confirm that Worlds charges a 30% platform fee before saving a paid collectible.');return;}
    try{
      if(name && commerce.priceMinor > 0) await acknowledgePaidCollectibleFee(stop.id);
      await configureHuntDropCommerce({
        stopId:stop.id,findLimit:commerce.findLimit,collectibleName:name||null,
        collectibleDescription:name?(commerce.collectibleDescription.trim()||null):null,
        priceMinor:name?commerce.priceMinor:null,quantity:name?commerce.quantity:null,
      });
      router.back();
    }catch(error){Alert.alert('Commerce settings not saved',error instanceof Error?error.message:'Please try again.');}
  };
  const captureSweep=async()=>{if(stop.id.startsWith('local-stop-')){Alert.alert('Save this stop first','Wait for the draft to save, then capture a sweep tied to this stop and Hunt version.');return;}setSweeping(true);try{const session=await beginCreatorStopSweep(id,stop.id);const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw new Error('Camera permission is required for a live safety sweep.');const result=await ImagePicker.launchCameraAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,allowsEditing:false,quality:0.85});if(result.canceled||!result.assets[0])return;const mediaId=await uploadCreatorStopSweep(id,session.sessionId,result.assets[0].uri);set({sweepEvidenceMediaId:mediaId});}catch(error){Alert.alert('Sweep not saved',error instanceof Error?error.message:'Please try again.');}finally{setSweeping(false)}};
  return <CreatorStepLayout step="stops" draftId={id} saveState={c.saveState}><SectionIntro title={`Stop ${index+1}`} body="Keep this focused. Players should know what to do and how to complete it."/>
    <Input label="Stop title" value={stop.title} onChangeText={title=>set({title})} placeholder="Find the blue door"/>
    <Input label="Instructions" value={stop.instruction} onChangeText={instruction=>set({instruction})} multiline placeholder="Look for…"/>
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:12}]}>Stop type</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['location','activity','clue','mixed'] as CreatorStopType[]).map(v=><Button key={v} size="sm" variant={stop.type===v?'primary':'outline'} onPress={()=>set({type:v})}>{v}</Button>)}</View>
    <Button fullWidth variant={stop.required?'primary':'outline'} onPress={()=>set({required:!stop.required})}>{stop.required?'Required stop':'Optional stop'}</Button>
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:16}]}>Proof requirement</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['manual_confirmation','location','text','image','image_and_location','text_and_image'] as const).map(v=><Button key={v} size="sm" variant={stop.completionMethod===v?'primary':'outline'} onPress={()=>set({completionMethod:v})}>{v.replaceAll('_',' ')}</Button>)}</View>
    {stop.completionMethod!=='manual_confirmation'&&<View style={{gap:8,marginTop:12}}><Text style={{color:colors.mutedForeground}}>Safety evidence must be captured live with your camera and is tied to this stop version.</Text><Button fullWidth variant={stop.sweepEvidenceMediaId?'outline':'primary'} loading={sweeping} onPress={captureSweep}>{stop.sweepEvidenceMediaId?'Recapture live safety sweep':'Capture live safety sweep'}</Button></View>}
    <Input label="Clue" value={stop.clueText} onChangeText={clueText=>set({clueText})} multiline placeholder="Your clue appears when this stop unlocks."/>
    <Input label="Hint (optional)" value={stop.hintText} onChangeText={hintText=>set({hintText})} multiline/>
    {stop.completionMethod==='text' && <Input label="Riddle answer (private)" secure value={stop.riddleAnswer} onChangeText={riddleAnswer=>set({riddleAnswer})} placeholder="Only trusted validation can use this"/>}
    <Input label="Safety note (optional)" value={stop.safetyNote} onChangeText={safetyNote=>set({safetyNote})} multiline/>
    <Input label="Accessibility note (optional)" value={stop.accessibilityNote} onChangeText={accessibilityNote=>set({accessibilityNote})} multiline/>
    <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:18}]}>Drop commerce</Text>
    <Text style={{color:colors.mutedForeground}}>The find limit controls verified discoveries. Leave it blank for unlimited; when exhausted, this Drop disappears from active discovery.</Text>
    <Input label="Find limit (blank = unlimited)" value={commerce.findLimit?.toString() ?? ''} onChangeText={value=>setCommerce({findLimit:parseOptionalPositive(value)})} keyboardType="number-pad"/>
    <Input label="Collectible name (optional)" value={commerce.collectibleName} onChangeText={collectibleName=>setCommerce({collectibleName})} placeholder="Leave blank for no collectible"/>
    {!!commerce.collectibleName.trim()&&<>
      <Input label="Collectible description" value={commerce.collectibleDescription} onChangeText={collectibleDescription=>setCommerce({collectibleDescription})} multiline/>
       <Text style={[creatorStyles.label,{color:colors.foreground,marginTop:8}]}>Collectible pricing</Text>
       <View style={{flexDirection:'row',gap:8}}>
         <Button size="sm" variant={commerce.priceMinor===0?'primary':'outline'} onPress={()=>{setCommerce({priceMinor:0});setPaidFeeAcknowledged(false);}}>Free · $0</Button>
         <Button size="sm" variant={commerce.priceMinor>0?'primary':'outline'} onPress={()=>{if(commerce.priceMinor===0)setCommerce({priceMinor:100});setPaidFeeAcknowledged(false);}}>Paid</Button>
       </View>
       {commerce.priceMinor>0&&<Input label="Paid price in cents (minimum 100)" value={commerce.priceMinor.toString()} onChangeText={value=>{setCommerce({priceMinor:Number.parseInt(value.replace(/\D/g,''),10)||0});setPaidFeeAcknowledged(false);}} keyboardType="number-pad"/>}
      <Input label="Quantity (blank = unlimited)" value={commerce.quantity?.toString() ?? ''} onChangeText={value=>setCommerce({quantity:parseOptionalPositive(value)})} keyboardType="number-pad"/>
      <Input label="Rarity (set by quantity)" value={rarityForQuantity(commerce.quantity)} editable={false}/>
       {commerce.priceMinor>0&&<>
         <Text style={{color:colors.mutedForeground}}>Worlds charges a 30% platform fee on collectible sales. The intended creator share is 70% before external fees, taxes, refunds, reversals, or other adjustments.</Text>
         <Button fullWidth variant={paidFeeAcknowledged?'primary':'outline'} onPress={()=>setPaidFeeAcknowledged(!paidFeeAcknowledged)}>
           {paidFeeAcknowledged?'30% platform fee acknowledged':'I acknowledge the 30% platform fee'}
         </Button>
       </>}
      <Text style={{color:colors.mutedForeground}}>Paid collectibles remain unavailable until the seller completes verification. Free collectibles do not require seller verification.</Text>
    </>}
    <CreatorNext label="Save stop" onPress={saveStop}/></CreatorStepLayout>;
}