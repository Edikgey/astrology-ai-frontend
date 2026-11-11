import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import PublicBehavior from './PublicBehavior';
import {useLocation} from 'react-router-dom';
import {clarityAnalytics} from '../analytics/clarity';
import {observeLanding} from '../analytics/behavior';
import {onPreferenceChange} from '../analytics/consent';
jest.mock('react-router-dom',()=>({useLocation:jest.fn()}),{virtual:true});
jest.mock('../analytics/clarity',()=>({clarityAnalytics:{canTrack:jest.fn(),track:jest.fn()},newAnalyticsFlow:jest.fn()}));
jest.mock('../analytics/behavior',()=>({observeLanding:jest.fn()}));
jest.mock('../analytics/consent',()=>({onPreferenceChange:jest.fn()}));
let root,container,stop,unsubscribe,preference;
beforeEach(()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 stop=jest.fn();unsubscribe=jest.fn();observeLanding.mockReturnValue(stop);useLocation.mockReturnValue({pathname:'/'});
 clarityAnalytics.canTrack.mockReturnValue(true);onPreferenceChange.mockImplementation(fn=>{preference=fn;return unsubscribe;});jest.clearAllMocks();
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=()=>act(async()=>root.render(<PublicBehavior/>));
test('no duplicate observer on focus/saved consent; removes everything on route exit',async()=>{
 await render();preference();preference();expect(observeLanding).toHaveBeenCalledTimes(1);expect(container.textContent).toBe('');
 useLocation.mockReturnValue({pathname:'/authorization'});await render();expect(stop).toHaveBeenCalledTimes(1);expect(unsubscribe).toHaveBeenCalledTimes(1);expect(observeLanding).toHaveBeenCalledTimes(1);
});
test('reject never attaches listeners; accept attaches; withdrawal and exclusion clean up',async()=>{
 clarityAnalytics.canTrack.mockReturnValue(false);await render();expect(observeLanding).not.toHaveBeenCalled();
 clarityAnalytics.canTrack.mockReturnValue(true);preference();expect(observeLanding).toHaveBeenCalledTimes(1);
 clarityAnalytics.canTrack.mockReturnValue(false);preference();expect(stop).toHaveBeenCalledTimes(1);
 clarityAnalytics.canTrack.mockReturnValue(true);preference();expect(observeLanding).toHaveBeenCalledTimes(2);
});
