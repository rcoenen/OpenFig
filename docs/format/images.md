# Images

## Storage

Image files are stored in the `images/` directory inside the ZIP archive. Each file
is named by its **40-character lowercase hex SHA-1 hash** with no file extension:

```
images/
  780960f6236bd1305ceeb2590ca395e36e705816
  3edd7b8ee12e0f653393f430503ff8738e4e5dc7
```

Both full-resolution images and their thumbnails (~320px wide PNGs) are stored here,
each under their own hash.

## Thumbnail Generation

Every image requires a companion thumbnail:
- Resize to ~320px wide (maintain aspect ratio, don't enlarge)
- Save as PNG
- Store in `images/` under its own SHA-1 hash

## Image Override on Symbol Instance

See [overrides.md](overrides.md) for the full image override structure used when
replacing an image placeholder inside a component instance.

## Freestanding Image on Slide ❓

Placing an image directly on a slide (not via symbol override) has not yet been
investigated. Likely uses a `fillPaints` entry with `type: 'IMAGE'` on a
ROUNDED_RECTANGLE node.
