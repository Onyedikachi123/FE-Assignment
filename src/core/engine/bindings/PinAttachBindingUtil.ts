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
        if (this.syncing.has(binding.fromId)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const before = shapeBefore as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const toShape = this.editor.getShape(binding.toId);
        if (!toShape) return;

        this.syncing.add(binding.toId);
        this.editor.updateShape({
            id: toShape.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (toShape as any).type,
            x: after.x - binding.props.relativeOffset.x,
            y: after.y - binding.props.relativeOffset.y,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        this.syncing.delete(binding.toId);
    }

    override onAfterChangeToShape({
        binding,
        shapeBefore,
        shapeAfter,
    }: BindingOnShapeChangeOptions<PinAttachBinding>): void {
        if (this.syncing.has(binding.toId)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const before = shapeBefore as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const after = shapeAfter as any;
        if (before.x === after.x && before.y === after.y) return;

        const fromShape = this.editor.getShape(binding.fromId);
        if (!fromShape) return;

        this.syncing.add(binding.fromId);
        this.editor.updateShape({
            id: fromShape.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (fromShape as any).type,
            x: after.x + binding.props.relativeOffset.x,
            y: after.y + binding.props.relativeOffset.y,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        this.syncing.delete(binding.fromId);
    }

    override onBeforeDelete(): void {
        // Detaching is correct
    }
}
