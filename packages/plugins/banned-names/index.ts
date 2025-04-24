import {definePlugin } from "../../../apps/api/src/core/plugins";
import { PluginContext } from "../../../apps/api/src/core/plugins/pluginManifest.schema";


export default definePlugin(async (ctx: PluginContext) => {
  console.log('[banned-names]','banned names plugin activated');

  ctx.hooks.addAction('server:started', () => {
    console.log('[banned-names] banned names plugin: server started');
  });

  ctx.hooks.addAction('svc.users.get:action:before', () => {
    console.log('[banned-names] banned names plugin: before getUsers');
  });

  ctx.router.get('/banned-names', (req, res)=>{
    res.json({ message: 'banned names plugin' });
  })



  /* optional cleanup */
  return () => console.log('[banned-names] banned names plugin deactivated');
});