import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreateHuntDraft } from '@/features/hunts/hooks/creatorHooks';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
export default function CreateHuntEntry() {
  const colors = useColors(); const { user } = useAuth(); const create = useCreateHuntDraft(user?.id ?? null);
  if (!user) return <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:24, backgroundColor:colors.background }}><Text style={{ color:colors.foreground }}>Sign in to create a Hunt.</Text></View>;
  return <View style={{ flex:1, justifyContent:'center', padding:24, backgroundColor:colors.background }}>
    <Text style={{ color:colors.foreground, fontSize:28, fontWeight:'700', marginBottom:8 }}>Build an adventure</Text>
    <Text style={{ color:colors.mutedForeground, fontSize:16, lineHeight:23, marginBottom:24 }}>Create a thoughtful Hunt for friends and explorers. You can save your draft and finish it anytime.</Text>
    <Button fullWidth loading={create.isPending} onPress={() => create.mutate(undefined, { onSuccess: d => router.replace(`/(main)/hunt/create/${d.id}/details`) })}>Start a new Hunt</Button>
    {!!create.isError && <Text style={{ color:colors.destructive, marginTop:12 }}>We couldn't start a draft. Please try again.</Text>}
  </View>;
}