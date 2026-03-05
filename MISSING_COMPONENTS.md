# Missing Components & Improvements

_All previously identified critical missing components have been resolved._

## Potential Future Hardening

- **Performance**: Move high-res preloading to a dedicated Web Worker to further
  isolate main-thread CPU spikes.
- **Testing**: Implement full visual regression testing for canvas rendering
  using Playwright snapshots to catch subtle rendering regressions.
- **Product**: Add multi-select support for pinning multiple objects to a single
  group with one click.
