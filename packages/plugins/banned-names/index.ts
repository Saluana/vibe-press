import {definePlugin } from "@vp/core/plugins";
import { PluginContext } from "@vp/core/plugins/pluginManifest.schema";


export default definePlugin(async (ctx: PluginContext) => {
  console.log('[banned-names]','banned names plugin activated');

  ctx.hooks.addAction('server:started', () => {
    console.log('[banned-names] banned names plugin: server started');
  });

  ctx.hooks.addAction('svc.users.get:action:before', () => {
    console.log('[banned-names] banned names plugin: before getUsers');
  });

  ctx.router.get('/', async (req, res)=>{
    const users = await ctx.services.user.getUserByLoginOrEmail('admin');
    res.json({ users: users });
  });


  /* optional cleanup */
  return () => console.log('[banned-names] banned names plugin deactivated');
});