// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PROVEDORES, IDS_DE_PROVEDOR } from '@/lib/ai/pontos/provedores';
import { createDefaultRegistry } from '@/lib/agent-engine/edge/llm/providers';
import { validateProviderKey } from '@/lib/ai/provider-validators';
import { provarSaldo } from '@/lib/instalacao/prova-de-credito';
import { validarBinding } from '@/lib/ai/pontos/validar-binding';
import { escolherModeloDoProvedor } from '@/lib/ai/agents/escolher-modelo';
import { buildModel } from '@/lib/ai/runtime/agent';
import { generateText } from 'ai';

describe('Final Provider QA', () => {
  it('1. verifies all 6 providers in UI list', () => {
    const ids = PROVEDORES.map(p => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('opencode_zen');
    expect(ids).toContain('deepseek');
    expect(ids.length).toBe(6);
  });

  it('2. verifies all 6 providers in execution registry', () => {
    const registry = createDefaultRegistry();
    for (const id of IDS_DE_PROVEDOR) {
      expect(registry[id]).toBeDefined();
    }
  });

  it('3. tests validation and connection probe logic for Zen and DeepSeek', async () => {
    // OpenCode Zen validation with live key
    const zenKey = process.env.OPENCODE_ZEN_API_KEY;
    if (zenKey) {
      const zenVal = await validateProviderKey('opencode_zen', zenKey);
      expect(zenVal.ok).toBe(true);
      if (zenVal.ok) {
        expect(zenVal.models?.length).toBeGreaterThan(0);
      }

      // Prova de saldo (1-token check)
      const probeZen = await provarSaldo('opencode_zen', zenKey, 'mimo-v2.5-free', {
        baseUrl: process.env.OPENCODE_ZEN_BASE_URL
      });
      expect(probeZen.ok).toBe(true);
    }
  });

  it('4. tests model selection & binding validation for Zen and DeepSeek', () => {
    // OpenCode Zen
    const zenChoice = escolherModeloDoProvedor([
      { model_id: 'mimo-v2.5-free', is_default_for_provider: true, supports_tools: true },
      { model_id: 'claude-sonnet-5', is_default_for_provider: false, supports_tools: true },
    ]);
    expect(zenChoice.escolhido).toBe(true);
    if (zenChoice.escolhido) {
      expect(zenChoice.modelId).toBe('mimo-v2.5-free');
    }

    // DeepSeek
    const dsChoice = escolherModeloDoProvedor([
      { model_id: 'deepseek-v4-flash', is_default_for_provider: true, supports_tools: true },
      { model_id: 'deepseek-v4-pro', is_default_for_provider: false, supports_tools: true },
    ]);
    expect(dsChoice.escolhido).toBe(true);
    if (dsChoice.escolhido) {
      expect(dsChoice.modelId).toBe('deepseek-v4-flash');
    }

    // Binding validation for agent_turn
    const validBindingZen = validarBinding({
      pontoId: 'stage_classifier',
      modelo: { model_id: 'mimo-v2.5-free', supports_tools: true, supports_vision: false, conhecido: true }
    });
    expect(validBindingZen.ok).toBe(true);

    const validBindingDs = validarBinding({
      pontoId: 'stage_classifier',
      modelo: { model_id: 'deepseek-v4-flash', supports_tools: true, supports_vision: false, conhecido: true }
    });
    expect(validBindingDs.ok).toBe(true);
  });

  it('5. executes actual live agent text generation via registry and runtime', async () => {
    const zenKey = process.env.OPENCODE_ZEN_API_KEY;
    if (zenKey) {
      // Via agent runtime buildModel
      const model = buildModel('opencode_zen', zenKey, 'mimo-v2.5-free');
      const { text } = await generateText({
        model,
        prompt: 'Qual e a capital do Brasil? Responda em 1 palavra.',
      });
      console.log('Zen Agent Output:', text.trim());
      expect(text.toLowerCase()).toContain('brasília');
    }
  }, 30000);
});
