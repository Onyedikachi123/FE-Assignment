import {
    BindingUtil,
    BindingOnShapeChangeOptions,
    BindingOnDeleteOptions,
    TLBaseBinding,
    createBindingValidator,
    T,
} from 'tldraw';

export interface PinAttachBindingProps {
    relativeOffset: { x: number; y: number };
    pinShapeId: string;
}

/**
 * PinAttachBinding type.
 * Using TLBaseBinding with 'pin-attach' type and our custom props.
 * TLGlobalBindingPropsMap is augmented via module declaration below.
 */
export type PinAttachBinding = TLBaseBinding<'pin-attach', PinAttachBindingProps>;

// Augment tldraw's global binding type registry so our custom type is recognised
declare module 'tldraw' {
    interface TLGlobalBindingPropsMap {
        'pin-attach': PinAttachBindingProps;
    }
}

/**
 * PinAttachBindingUtil
 *
 * The authoritative, undo-safe implementation of shape attachment.
 * Uses tldraw's native BindingUtil system (Option C) — executed synchronously
 * within the same store transaction so CMD+Z perfectly reverts both shapes.
 *
 * Loop prevention: The `syncing` Set tracks which shape IDs are currently
 * being updated by us so we don't re-enter the handler infinitely.
 */
export class PinAttachBindingUtil extends BindingUtil<PinAttachBinding> {
    static override type = 'pin-attach' as const;

    private syncing = new Set<string>();

    override getDefaultProps(): PinAttachBindingProps {
        return {
            relativeOffset: { x: 0, y: 0 },
            pinShapeId: '',
        };
    }

    validator = createBindingValidator(
        'pin-attach' as any,
        T.object({
            relativeOffset: T.object({ x: T.number, y: T.number }),
            pinShapeId: T.string,
        }) as any
    );

    /**
     * Called when the "from" shape (shapeA) changes.
     * We update the "to" shape (shapeB) to maintain the stored relative offset.
     */
    override onAfterChangeFromShape({
        binding,
        shapeBefore,
        shapeAfter,
    }: BindingOnShapeChangeOptions<PinAttachBinding>): void {
        if (this.syncing.has(binding.fromId)) return;

        const before = shapeBefore as any;
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const toShape = this.editor.getShape(binding.toId) as any;
        if (!toShape) return;

        this.syncing.add(binding.toId);
        this.editor.updateShape({
            id: toShape.id,
            type: toShape.type as any,
            x: after.x - binding.props.relativeOffset.x,
            y: after.y - binding.props.relativeOffset.y,
        });
        this.syncing.delete(binding.toId);
    }

    /**
     * Called when the "to" shape (shapeB) changes.
     * We update the "from" shape (shapeA) to maintain the stored relative offset.
     */
    override onAfterChangeToShape({
        binding,
        shapeBefore,
        shapeAfter,
    }: BindingOnShapeChangeOptions<PinAttachBinding>): void {
        if (this.syncing.has(binding.toId)) return;

        const before = shapeBefore as any;
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const fromShape = this.editor.getShape(binding.fromId) as any;
        if (!fromShape) return;

        this.syncing.add(binding.fromId);
        this.editor.updateShape({
            id: fromShape.id,
            type: fromShape.type as any,
            x: after.x + binding.props.relativeOffset.x,
            y: after.y + binding.props.relativeOffset.y,
        });
        this.syncing.delete(binding.fromId);
    }

    override onBeforeDelete(_options: BindingOnDeleteOptions<PinAttachBinding>): void {
        // Intentionally empty — detaching is the correct behaviour when a pin is removed
    }
}
