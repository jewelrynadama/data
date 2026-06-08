import urllib.request, re

url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThQ2kPUPjRXfJBTB7rxJOrpQf2bIyghtOVZPcvnzEQDu0-KhLp-rxMu8mws-HsBLmQCXYUxlFiZlmk/pubhtml?gid=804242596&single=true"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
text = urllib.request.urlopen(req).read().decode('utf-8')

images = re.findall(r'https://lh\d.googleusercontent.com/[^\"]+', text)
print("Total images found:", len(images))
for i in range(min(5, len(images))):
    print(images[i])
