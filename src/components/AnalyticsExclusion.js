import React,{useEffect,useState} from 'react';
import {isExcluded,setExcluded,onPreferenceChange} from '../analytics/consent';

export default function AnalyticsExclusion() {
  const [excluded,setOwn]=useState(isExcluded);
  useEffect(()=>onPreferenceChange(()=>setOwn(isExcluded())),[]);
  return <button type="button" className="privacy-cookie-settings" aria-pressed={excluded}
    onClick={()=>setExcluded(!excluded)}>{excluded?'Разрешить аналитику на этом устройстве':'Не учитывать мои посещения'}</button>;
}
