import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

export default function SearchBar({ value, onChangeText, placeholder }:{
  value:string, onChangeText:(s:string)=>void, placeholder?:string
}) {
  return (
    <View style={s.wrap}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder||'Search ticker...'} style={s.input} autoCapitalize="characters" />
    </View>
  );
}
const s = StyleSheet.create({
  wrap:{ padding:10 },
  input:{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }
});

