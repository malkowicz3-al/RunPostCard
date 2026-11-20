import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadItems, DownloadMenu } from './DownloadMenu';

const noop = () => {};

describe('DownloadMenu', () => {
  it('still: PNG i SVG; animation: MP4 i GIF; bez POV, gdy go nie ma', () => {
    const still = renderToStaticMarkup(<DownloadItems mode="still" mp4Supported onPick={noop} />);
    expect(still).toContain('PNG image');
    expect(still).toContain('SVG (vector)');
    expect(still).not.toContain('MP4');
    expect(still).not.toContain('disabled');
    const anim = renderToStaticMarkup(<DownloadItems mode="animation" mp4Supported onPick={noop} />);
    expect(anim).toContain('Video (MP4)');
    expect(anim).toContain('GIF (animated)');
    expect(anim).not.toContain('PNG');
    expect(anim).not.toContain('POV');
    expect(anim).not.toContain('disabled');
  });

  it('POV w obu trybach', () => {
    for (const mode of ['still', 'animation'] as const) {
      const html = renderToStaticMarkup(<DownloadItems mode={mode} mp4Supported povSupported onPick={noop} />);
      expect(html).toContain('>POV video (MP4)</button>');
    }
    expect(renderToStaticMarkup(<DownloadItems mode="still" mp4Supported povSupported onPick={noop} />)).not.toContain('>Video (MP4)');
  });

  it('nieaktywne z powodem: MP4 i POV bez WebCodecs, POV bez WebGL lub strumieni', () => {
    const anim = renderToStaticMarkup(<DownloadItems mode="animation" mp4Supported={false} povSupported onPick={noop} />);
    expect(anim).toContain('disabled="">Video (MP4) (not supported in this browser)');
    expect(anim).toContain('disabled="">POV video (MP4) (not supported in this browser)');
    const still = renderToStaticMarkup(<DownloadItems mode="still" mp4Supported povNote="needs WebGL and run streams" onPick={noop} />);
    expect(still).toContain('disabled="">POV video (MP4) (needs WebGL and run streams)');
  });

  it('zamknięte menu: tylko przycisk Download', () => {
    const html = renderToStaticMarkup(
      <DownloadMenu disabled={false} onPng={noop} onSvg={noop} onMp4={noop} onGif={noop} mp4Supported mode="still" />,
    );
    expect(html).toContain('Download');
    expect(html).not.toContain('menuitem');
  });
});
