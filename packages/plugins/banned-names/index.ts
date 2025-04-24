import {definePlugin } from "@vp/core/plugins";
import { PluginContext } from "@vp/core/plugins/pluginManifest.schema";
import { db } from "@vp/core/db";



export default definePlugin(async (ctx: PluginContext) => {
  console.log('[banned-names]','banned names plugin activated');

  ctx.hooks.addAction('server:started', () => {
    console.log('[banned-names] banned names plugin: server started');
  });

  ctx.hooks.addAction('svc.users.get:action:before', () => {
    console.log('[banned-names] banned names plugin: before getUsers');
  });

  console.log(db)

  ctx.router.get('/banned-names', (req, res)=>{
    res.json({ message: 'banned names plugin' });
  })

  /* optional cleanup */
  return () => console.log('[banned-names] banned names plugin deactivated');
});