import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { CreatorNext, CreatorStepLayout } from '@/components/hunt-creator/CreatorStepLayout';
import { useCreatorDraftEditor } from '@/features/hunts/creator/useCreatorDraftEditor';
import { makeCreatorStop } from '@/features/hunts/types/creator.types';
import { useColors } from '@/hooks/useColors';
import { Alert } from 'react-native';
export default function Stops() {
  const {draftId}=useLocalSearchParams<{draftId:string}>(); const id=String(draftId); const c=useCreatorDraftEditor(id); const colors=useColors();
  const add=()=>{const stop=makeCreatorStop(c.payload.stops.length+1); c.setPayload({...c.payload,stops:[...c.payload.stops,stop]}); router.push(`/(main)/hunt/create/${id}/stop/${stop.id}`)};
  const move=(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=c.payload.stops.length)return;const stops=[...c.payload.stops];[stops[index],stops[next]]=[stops[next],stops[index]];c.setPayload({...c.payload,stops})};
  const duplicate=(stop: typeof c.payload.stops[number])=>c.setPayload({...c.payload,stops:[...c.payload.stops,{...stop,id:`local-stop-${Date.now()}-${c.payload.stops.length+1}`,title:`${stop.title || 'Untitled stop'} Copy`,location:stop.location?{...stop.location,confirmed:false}:null}]});
  const remove=(stop: typeof c.payload.stops[number])=>Alert.alert('Delete this stop?','Its clue, proof, and location settings will be removed from this draft.',[{text:'Keep stop',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>c.setPayload({...c.payload,stops:c.payload.stops.filter(s=>s.id!==stop.id)})}]);
  return <CreatorStepLayout step="stops" draftId={id} saveState={c.saveState}><Text style={{fontSize:24,fontWeight:'700',color:colors.foreground}}>Build the route</Text><Text style={{color:colors.mutedForeground,marginVertical:8}}>Add at least one required stop. You can reorder without losing stable stop IDs.</Text>
    {c.payload.stops.map((stop,index)=><View key={stop.id} style={{padding:16,borderWidth:1,borderColor:colors.border,borderRadius:12,marginTop:10,backgroundColor:colors.card}}><View style={{flexDirection:'row',alignItems:'center'}}><Text style={{fontWeight:'700',color:colors.foreground,flex:1}}>{index+1}. {stop.title||'Untitled stop'}</Text><TouchableOpacity onPress={()=>router.push(`/(main)/hunt/create/${id}/stop/${stop.id}`)}><Feather name="edit-2" size={18} color={colors.primary}/></TouchableOpacity></View><Text style={{color:colors.mutedForeground,marginTop:5}}>{stop.required?'Required':'Optional'} · {stop.type}</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}><Button size="sm" variant="outline" disabled={index===0} onPress={()=>move(index,-1)}>↑ Move</Button><Button size="sm" variant="outline" disabled={index===c.payload.stops.length-1} onPress={()=>move(index,1)}>↓ Move</Button><Button size="sm" variant="outline" onPress={()=>duplicate(stop)}>Duplicate</Button><Button size="sm" variant="destructive" onPress={()=>remove(stop)}>Delete</Button></View></View>)}
    <Button fullWidth variant="outline" onPress={add}>+ Add stop</Button><CreatorNext onPress={()=>router.push(`/(main)/hunt/create/${id}/invite`)} disabled={!c.payload.stops.length}/></CreatorStepLayout>;
}