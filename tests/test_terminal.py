import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from terminal_backend import response, widgets, Handler
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import urlopen
class TerminalBackendTests(unittest.TestCase):
 def test_backend_returns_dated_public_holdings_and_rejects_unknown_ids(self):
  with TemporaryDirectory() as d:
   p=Path(d);p.joinpath('ownership-companies.json').write_text(json.dumps({'companies':[{'id':'tcs','name':'TCS','scope':'Selected holders','owners':[{'label':'Holder','percent':5,'asOf':'2026-03-31','kind':'Named shareholder','source':'https://example.com'}]}]}))
   rows=response('/ownership',{'company':'tcs'},p)
   self.assertEqual(rows[0]['holding_date'],'2026-03-31');self.assertEqual(rows[0]['percent'],5)
   with self.assertRaises(ValueError):response('/ownership',{'company':'../private'},p)
   with self.assertRaises(LookupError):response('/private',{},p)
 def test_openbb_widgets_map_to_fixed_read_only_endpoints(self):
  self.assertEqual({w['endpoint'] for w in widgets().values()},{'ownership','economy','documents'})
  self.assertTrue(all(w['type']=='table' for w in widgets().values()))

 def test_local_backend_serves_openbb_widget_contract_over_http(self):
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
  thread=Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   with urlopen('http://127.0.0.1:'+str(server.server_port)+'/widgets.json',timeout=3) as result:
    self.assertEqual(result.status,200)
    self.assertEqual(len(json.load(result)),3)
  finally:server.shutdown();server.server_close();thread.join()
