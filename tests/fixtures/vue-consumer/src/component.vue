<script setup lang="ts">
import { standard } from './standard';
const message: string = standard ? 'hello' : 'world'
</script>

<template>
  <img :alt="message" src="/logo.png" style="color: red;">
  <img src="/missing-alt.png" />
</template>
