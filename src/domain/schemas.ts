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
              derivedFrom: z.string().min(1).optional(),
              derivedForms: z.array(z.string().min(1)).min(1).max(2).optional(),
              mark: z.enum(['dakuten', 'handakuten']).optional(),
            })
            .catchall(z.unknown()),
        }),
      )
      .length(71),
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
    const itemById = new Map(manifest.items.map((item) => [item.id, item]));
    const baseItems = manifest.items.filter(
      (item) => !item.content.derivedFrom,
    );
    const derivedItems = manifest.items.filter((item) =>
      Boolean(item.content.derivedFrom),
    );
    const dakutenItems = derivedItems.filter(
      (item) => item.content.mark === 'dakuten',
    );
    const handakutenItems = derivedItems.filter(
      (item) => item.content.mark === 'handakuten',
    );

    if (
      baseItems.length !== 46 ||
      derivedItems.length !== 25 ||
      dakutenItems.length !== 20 ||
      handakutenItems.length !== 5
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Manifest must contain 46 base kana, 20 dakuten forms, and 5 handakuten forms.',
        path: ['items'],
      });
    }

    for (const [itemIndex, item] of manifest.items.entries()) {
      const { derivedFrom, derivedForms, mark } = item.content;
      if (derivedFrom) {
        const base = itemById.get(derivedFrom);
        if (
          !base ||
          base.content.derivedFrom ||
          !mark ||
          base.content.column !== item.content.column ||
          !base.content.derivedForms?.includes(item.id)
        ) {
          context.addIssue({
            code: 'custom',
            message:
              'Derived kana must reference a reciprocal base item in the same column.',
            path: ['items', itemIndex, 'content', 'derivedFrom'],
          });
        }
      } else if (mark) {
        context.addIssue({
          code: 'custom',
          message: 'Only derived kana may declare a mark.',
          path: ['items', itemIndex, 'content', 'mark'],
        });
      }

      for (const derivedId of derivedForms ?? []) {
        const derived = itemById.get(derivedId);
        if (
          !derived ||
          derived.content.derivedFrom !== item.id ||
          derived.content.column !== item.content.column
        ) {
          context.addIssue({
            code: 'custom',
            message:
              'Base kana derivedForms must contain reciprocal children in the same column.',
            path: ['items', itemIndex, 'content', 'derivedForms'],
          });
        }
      }

      if (
        !derivedFrom &&
        item.content.rowId === 'h' &&
        derivedForms?.length !== 2
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Every H-row base kana must have dakuten and handakuten forms.',
          path: ['items', itemIndex, 'content', 'derivedForms'],
        });
      }
      if (!derivedFrom && item.content.rowId === 'h') {
        const marks = (derivedForms ?? [])
          .map((derivedId) => itemById.get(derivedId)?.content.mark)
          .sort();
        if (
          marks.length !== 2 ||
          marks[0] !== 'dakuten' ||
          marks[1] !== 'handakuten'
        ) {
          context.addIssue({
            code: 'custom',
            message:
              'Every H-row base kana must link to one dakuten and one handakuten form.',
            path: ['items', itemIndex, 'content', 'derivedForms'],
          });
        }
      }
      if (
        !derivedFrom &&
        ['k', 's', 't'].includes(item.content.rowId) &&
        (derivedForms?.length !== 1 ||
          itemById.get(derivedForms[0])?.content.mark !== 'dakuten')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Every K, S, and T-row base kana must have one dakuten form.',
          path: ['items', itemIndex, 'content', 'derivedForms'],
        });
      }
    }

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
