import { z } from "zod";

export const ProductSessionLaunchConfigSchema = z.object({
    arguments: z.array(z.string()),
    executable: z.string(),
    locale: z.string(),
    workingDirectory: z.string(),
});

export type ProductSessionLaunchConfig = z.infer<
    typeof ProductSessionLaunchConfigSchema
>;

export const ProductSessionSchema = z.object({
    productId: z.string(),
    isInternal: z.boolean(),
    launchConfiguration: ProductSessionLaunchConfigSchema,
});

export type ProductSessionDTO = z.infer<typeof ProductSessionSchema>;