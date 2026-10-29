import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { EventPlanProposalSchema } from '../src/lib/domain/mutations';

async function verifyAI() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    console.log('ℹ️  No GOOGLE_GENERATIVE_AI_API_KEY detected in environment.');
    console.log('    To verify live Google Gemini API inference, run:');
    console.log('    GOOGLE_GENERATIVE_AI_API_KEY="your-key" npx tsx scripts/verify-ai.ts');
    process.exit(0);
  }

  console.log('🚀 Running AI Provider Verification Test (Google Gemini 2.5 Flash)...');
  const start = performance.now();

  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: EventPlanProposalSchema,
      prompt: `You are Celebration Copilot. Propose adding a jazz trio band under entertainment with estimated cost $1200, and a milestone for booking them 90 days before the event.`,
    });

    const duration = performance.now() - start;
    console.log(`⏱️  Roundtrip Latency: ${duration.toFixed(0)} ms (Measured Goal: < 2500 ms)`);
    console.log(`✅ Schema Adherence: Verified (${result.object.mutations.length} mutations parsed)`);
    console.log('📋 Sample Mutation Proposal:');
    console.log(JSON.stringify(result.object.mutations[0], null, 2));

    if (duration > 2500) {
      console.warn('⚠️  Warning: Latency exceeded 2.5s target.');
    } else {
      console.log('🎉 AI Verification Passed: Adherence verified, Latency within target.');
    }
  } catch (err) {
    console.error('❌ AI Verification Failed:', err);
    process.exit(1);
  }
}

verifyAI();
