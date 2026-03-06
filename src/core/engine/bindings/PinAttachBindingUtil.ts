import {
    BindingUtil,
    BindingOnShapeChangeOptions,
    TLBaseBinding,
    createBindingValidator,
    T,
} from 'tldraw';

export interface PinAttachBindingProps {
    relativeOffset: { x: number; y: number };
    pinShapeId: string;
}

/**
 * PinAttachBinding
 */
export type PinAttachBinding = TLBaseBinding<'pin-attach', PinAttachBindingProps>;

declare module 'tldraw' {
    interface TLGlobalBindingPropsMap {
        'pin-attach': PinAttachBindingProps;
    }
}

/**
 * PinAttachBindingUtil
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
        'pin-attach',
        {
            relativeOffset: T.object({ x: T.number, y: T.number }),
            pinShapeId: T.string,
        }
    );

    override onAfterChangeFromShape({
        binding,
        shapeBefore,
        shapeAfter,
    }: BindingOnShapeChangeOptions<PinAttachBinding>): void {
        if (this.syncing.has(binding.id)) return;

        // The 'from' shape is the PIN in our new hub-and-spoke model.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const before = shapeBefore as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const toShape = this.editor.getShape(binding.toId);
        if (!toShape) return;

        const targetX = after.x + binding.props.relativeOffset.x;
        const targetY = after.y + binding.props.relativeOffset.y;

        if (toShape.x === targetX && toShape.y === targetY) return;

        this.syncing.add(binding.id);
        this.editor.updateShape({
            id: toShape.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (toShape as any).type,
            x: targetX,
            y: targetY,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        this.syncing.delete(binding.id);
    }

    override onAfterChangeToShape({
        binding,
        shapeBefore,
        shapeAfter,
    }: BindingOnShapeChangeOptions<PinAttachBinding>): void {
        if (this.syncing.has(binding.id)) return;

        // The 'to' shape is the SHAPE.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const before = shapeBefore as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const pinShape = this.editor.getShape(binding.fromId);
        if (!pinShape) return;

        const targetX = after.x - binding.props.relativeOffset.x;
        const targetY = after.y - binding.props.relativeOffset.y;

        if (pinShape.x === targetX && pinShape.y === targetY) return;

        this.syncing.add(binding.id);
        this.editor.updateShape({
            id: pinShape.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (pinShape as any).type,
            x: targetX,
            y: targetY,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        this.syncing.delete(binding.id);
    }

    override onBeforeDelete(): void {
        // Detaching is correct
    }
}
