"""Small, isolated Scrapling worker. One JSON request and response per process."""
import contextlib
import io
import ipaddress
import json
import socket
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse


def public_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Only public HTTP(S) pages can be read.')
    if parsed.port not in (None, 80, 443):
        raise ValueError('Only standard web ports are supported.')
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443)
    if not addresses or any(not ipaddress.ip_address(entry[4][0]).is_global for entry in addresses):
        raise ValueError('Private or local network addresses cannot be read.')
    return url


def read_page(args):
    from scrapling.fetchers import Fetcher
    url = public_url(args['url'])
    for _ in range(6):
        page = Fetcher.get(url, follow_redirects=False, timeout=20, retries=2)
        if page.status in (301, 302, 303, 307, 308):
            location = page.headers.get('location') or page.headers.get('Location')
            if not location:
                raise ValueError('Redirect did not provide a destination.')
            url = public_url(urljoin(url, location))
            continue
        break
    else:
        raise ValueError('Too many redirects.')
    if page.status >= 400:
        raise ValueError(f'The source returned HTTP {page.status}. Try an alternative official page.')
    content_type = str(page.headers.get('content-type', page.headers.get('Content-Type', '')))
    if 'application/pdf' in content_type or urlparse(url).path.lower().endswith('.pdf'):
        from pypdf import PdfReader
        raw = page.body
        if isinstance(raw, str):
            raise ValueError('PDF download was not readable as binary.')
        reader = PdfReader(io.BytesIO(raw))
        text = '\n'.join((p.extract_text() or '') for p in reader.pages[:40])
        title = str(reader.metadata.title or 'Official PDF') if reader.metadata else 'Official PDF'
        links = []
    else:
        if args.get('dynamic'):
            # Dynamic pages only: no unrestricted redirects/navigation to private hosts.
            raise ValueError('JavaScript-only page. Find an accessible official HTML or PDF source instead.')
        title = page.css('title::text').get() or urlparse(url).hostname
        texts = page.xpath('//body//text()[not(ancestor::script) and not(ancestor::style) and not(ancestor::nav) and not(ancestor::footer) and not(ancestor::noscript)]').getall()
        text = '\n'.join(t.strip() for t in texts if t.strip())
        links = [{'text': ' '.join(a.xpath('.//text()').getall())[:120], 'url': urljoin(url, a.attrib.get('href', ''))} for a in page.css('a[href]')]
        import re
        links.sort(key=lambda item: bool(re.search(r'scholarship|funding|financial|tuition|admission|requirement|deadline|application', item['text']+' '+item['url'], re.I)), reverse=True)
        links = list({item['url']:item for item in links}.values())[:100]
    if len(text.strip()) < 150:
        raise ValueError('Page had too little readable content. Try another official source.')
    return {'url': url, 'requested_url': args['url'], 'title': title, 'text': text[:60000], 'links': links, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'engine': 'Scrapling', 'status': page.status}


def parse_pdf(args):
    import base64
    from pypdf import PdfReader
    raw = base64.b64decode(args['base64'], validate=True)
    reader = PdfReader(io.BytesIO(raw))
    if reader.is_encrypted and not reader.decrypt(''):
        raise ValueError('This PDF is password-protected. Upload an unlocked copy.')
    text = '\n'.join((p.extract_text() or '') for p in reader.pages[:40])
    return {'text': text[:40000], 'pages': len(reader.pages), 'truncated': len(reader.pages) > 40 or len(text) > 40000}


def search(args):
    from ddgs import DDGS
    results = list(DDGS(timeout=15).text(args['query'], max_results=min(int(args.get('limit', 6)), 10)))
    if not results:
        raise ValueError('Search returned no results. Rephrase the query or use a supplied official URL.')
    return {'results': [{'title': r.get('title'), 'url': r.get('href'), 'snippet': r.get('body')} for r in results], 'provider': 'ddgs', 'note': 'Discovery only. Read the official page before making verified claims.'}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read())
        # Libraries may print logs. Keep the stdout protocol clean.
        with contextlib.redirect_stdout(sys.stderr):
            result = parse_pdf(request['args']) if request['action'] == 'parse_pdf' else read_page(request['args']) if request['action'] == 'read_page' else search(request['args']) if request['action'] == 'search_web' else {'ready': True, 'scrapling': __import__('scrapling').__version__}
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'error': str(exc)[:400]}))
        sys.exit(1)
