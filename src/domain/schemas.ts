import { z } from 'zod';

const moduleTargetSchema = z.object({
  itemId: z.string().min(1),
  skillId: z.string().min(1),
});

const teachingModuleSchema = z.object({
  id: z.string().min(1),
  moduleType: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  content: z.record(z.string(), z.unknown()),
  targets: z.array(moduleTargetSchema).min(1),
});

export const curriculumManifestSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    publishedAt: z.string().datetime(),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(['hiragana', 'katakana', 'kanji', 'vocabulary']),
          schemaVersion: z.number().int().positive(),
          content: z
            .object({
              glyph: z.string().min(1),
              primaryAnswer: z.string().min(1),
              acceptedAnswers: z.array(z.string().min(1)).min(1),
              rowId: z.string().min(1),
              rowLabel: z.string().min(1),
              column: z.number().int().nonnegative(),
            })
            .catchall(z.unknown()),
        }),
      )
      .length(46),
    skills: z
      .array(
        z.object({
          id: z.string().min(1),
          schemaVersion: z.number().int().positive(),
          label: z.string().min(1),
          prompt: z.string().min(1),
          answerField: z.string().min(1),
        }),
      )
      .min(1),
    units: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          shortTitle: z.string().min(1),
          order: z.number().int().nonnegative(),
          modules: z.array(teachingModuleSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((manifest, context) => {
    const itemIds = manifest.items.map((item) => item.id);
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Learning item IDs must be unique.',
        path: ['items'],
      });
    }

    const glyphs = manifest.items.map((item) => item.content.glyph);
    if (new Set(glyphs).size !== glyphs.length) {
      context.addIssue({
        code: 'custom',
        message: 'Hiragana glyphs must be unique.',
        path: ['items'],
      });
    }

    const skillIds = new Set(manifest.skills.map((skill) => skill.id));
    for (const [unitIndex, unit] of manifest.units.entries()) {
      for (const [moduleIndex, module] of unit.modules.entries()) {
        for (const [targetIndex, target] of module.targets.entries()) {
          if (!uniqueItemIds.has(target.itemId) || !skillIds.has(target.skillId)) {
            context.addIssue({
              code: 'custom',
              message: 'Module target references an unknown item or skill.',
              path: [
                'units',
                unitIndex,
                'modules',
                moduleIndex,
                'targets',
                targetIndex,
              ],
            });
          }
        }
      }
    }
  });

export const supportedModuleSchemas = {
  'kana-introduction-v1': z.object({
    itemIds: z.array(z.string().min(1)).min(1),
    heading: z.string().min(1),
  }),
  'kana-reading-input-v1': z.object({
    itemIds: z.array(z.string().min(1)).min(1),
    prompt: z.string().min(1),
  }),
  'session-summary-v1': z.object({
    heading: z.string().min(1),
  }),
} as const;

export function validateSupportedModules(manifest: z.infer<typeof curriculumManifestSchema>) {
  for (const unit of manifest.units) {
    for (const module of unit.modules) {
      const schema =
        supportedModuleSchemas[
          module.moduleType as keyof typeof supportedModuleSchemas
        ];
      if (!schema || module.schemaVersion !== 1) {
        throw new Error(`Unsupported module renderer: ${module.moduleType}`);
      }
      schema.parse(module.content);
    }
  }
  return manifest;
}
