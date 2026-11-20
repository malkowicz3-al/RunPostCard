import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadItems, DownloadMenu } from './DownloadMenu';

const noop = () => {};

describe('DownloadMenu', () => {
  it('still: PNG i SVG; animation: MP4 i GIF', () => {
    const still = renderToStaticMarkup(<DownloadItems mode="still" mp4Supported onPick={noop} />);
    expect(still).toContain('PNG image');
    expect(still).toContain('SVG (vector)');
    expect(still).not.toContain('MP4');
    expect(still).not.toContain('disabled');
    const anim = renderToStaticMarkup(<DownloadItems mode="animation" mp4Supported onPick={noop} />);
    expect(anim).toContain('Video (MP4)');
    expect(anim).toContain('GIF (animated)');
    expect(anim).not.toContain('PNG');
    expect(anim).not.toContain('disabled');
  });

  it('MP4 nieaktywne z powodem bez WebCodecs', () => {
    const anim = renderToStaticMarkup(<DownloadItems mode="animation" mp4Supported={false} onPick={noop} />);
    expect(anim).toContain('disabled="">Video (MP4) (not supported in this browser)');
  });

  it('zamknięte menu: tylko przycisk Download', () => {
    const html = renderToStaticMarkup(
      <DownloadMenu disabled={false} onPng={noop} onSvg={noop} onMp4={noop} onGif={noop} mp4Supported mode="still" />,
    );
    expect(html).toContain('Download');
    expect(html).not.toContain('menuitem');
  });
});
