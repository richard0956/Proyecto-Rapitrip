from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
from pathlib import Path
import re
root=Path(r'C:\Users\alexa\Proyecto RT\tmp\rapitrip-redesign')
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
rel_ns='http://schemas.openxmlformats.org/package/2006/relationships'
count=0
with ZipFile(root/'draft.pptx') as z:
 content={n:z.read(n) for n in z.namelist()}
 for name in list(content):
  if not re.fullmatch(r'ppt/slides/slide\d+\.xml',name):continue
  tree=E.fromstring(content[name]);rp=name.replace('slides/','slides/_rels/')+'.rels'
  rels=E.fromstring(content[rp]) if rp in content else E.Element('{'+rel_ns+'}Relationships',nsmap={None:rel_ns})
  changed=False
  for shape in tree.findall('p:cSld/p:spTree/p:sp',ns):
   meta=shape.find('p:nvSpPr/p:cNvPr',ns);label=meta.get('name','')
   if label.startswith('link_slide_'):
    target='slide'+label[len('link_slide_'):]+'.xml';kind='slide';mode=None
   elif label.startswith('external_'):
    target=label[len('external_'):];kind='hyperlink';mode='External'
   else:continue
   rid='rIdRapitrip'+str(count+1)
   attrs={'Id':rid,'Type':ns['r']+'/'+kind,'Target':target}
   if mode:attrs['TargetMode']=mode
   E.SubElement(rels,'{'+rel_ns+'}Relationship',**attrs)
   for old in meta.findall('a:hlinkClick',ns):meta.remove(old)
   attrs={'{'+ns['r']+'}id':rid}
   if kind=='slide':attrs['action']='ppaction://hlinksldjump'
   E.SubElement(meta,'{'+ns['a']+'}hlinkClick',**attrs)
   count+=1;changed=True
  if changed:
   content[name]=E.tostring(tree,xml_declaration=True,encoding='UTF-8',standalone=True)
   content[rp]=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
 with ZipFile(root/'candidate-linked.pptx','w',ZIP_DEFLATED) as out:
  for n,v in content.items():out.writestr(n,v)
print('Hyperlinks added:',count)
