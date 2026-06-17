// Lightweight OUI → vendor lookup. Curated to ~100 common enterprise prefixes
// (Cisco, Juniper, Arista, HPE, Dell, VMware, Apple, Intel, etc.) rather than
// shipping the full 40k+ IEEE registry. Returns null for unknown OUIs so the
// caller can fall back to nothing or to a backend-provided manufacturer field.

import { isMAC, normaliseMAC } from './cell-link';

// Keys are the first 3 octets in canonical lowercase colon form: "aa:bb:cc".
const OUI: Record<string, string> = {
  // Cisco (sample of common prefixes — Cisco owns hundreds)
  '00:00:0c': 'Cisco', '00:01:42': 'Cisco', '00:01:43': 'Cisco', '00:01:63': 'Cisco',
  '00:01:64': 'Cisco', '00:01:96': 'Cisco', '00:01:97': 'Cisco', '00:01:c7': 'Cisco',
  '00:02:16': 'Cisco', '00:02:17': 'Cisco', '00:02:4a': 'Cisco', '00:02:4b': 'Cisco',
  '00:03:6b': 'Cisco', '00:03:6c': 'Cisco', '00:05:00': 'Cisco', '00:05:31': 'Cisco',
  '00:05:32': 'Cisco', '00:05:73': 'Cisco', '00:05:74': 'Cisco', '00:06:28': 'Cisco',
  '00:06:7c': 'Cisco', '00:07:0d': 'Cisco', '00:07:0e': 'Cisco', '00:07:50': 'Cisco',
  '00:09:43': 'Cisco', '00:09:44': 'Cisco', '00:0a:41': 'Cisco', '00:0a:42': 'Cisco',
  '00:0a:b7': 'Cisco', '00:0a:b8': 'Cisco', '00:0b:5f': 'Cisco', '00:0b:60': 'Cisco',
  '00:0d:28': 'Cisco', '00:0d:29': 'Cisco', '00:0e:38': 'Cisco', '00:0e:39': 'Cisco',
  '00:0f:23': 'Cisco', '00:0f:24': 'Cisco', '00:11:20': 'Cisco', '00:11:21': 'Cisco',
  '00:12:00': 'Cisco', '00:13:1a': 'Cisco', '00:13:c4': 'Cisco', '00:14:1b': 'Cisco',
  '00:15:62': 'Cisco', '00:15:63': 'Cisco', '00:17:0e': 'Cisco', '00:17:0f': 'Cisco',
  '00:18:18': 'Cisco', '00:18:19': 'Cisco', '00:19:30': 'Cisco', '00:1a:30': 'Cisco',
  '00:1b:0c': 'Cisco', '00:1b:53': 'Cisco', '00:1b:54': 'Cisco', '00:1c:0e': 'Cisco',
  '00:1c:0f': 'Cisco', '00:1d:45': 'Cisco', '00:1d:46': 'Cisco', '00:1e:13': 'Cisco',
  '00:1f:26': 'Cisco', '00:1f:27': 'Cisco', '00:1f:6c': 'Cisco', '00:21:1b': 'Cisco',
  '00:21:1c': 'Cisco', '00:21:55': 'Cisco', '00:21:56': 'Cisco', '00:21:a0': 'Cisco',
  '00:21:a1': 'Cisco', '00:22:0c': 'Cisco', '00:22:55': 'Cisco', '00:22:56': 'Cisco',
  '00:22:90': 'Cisco', '00:22:91': 'Cisco', '00:23:04': 'Cisco', '00:23:33': 'Cisco',
  '00:23:34': 'Cisco', '00:23:5d': 'Cisco', '00:23:5e': 'Cisco', '00:23:ab': 'Cisco',
  '00:23:ac': 'Cisco', '00:24:13': 'Cisco', '00:24:14': 'Cisco', '00:24:50': 'Cisco',
  '00:24:f7': 'Cisco', '00:25:45': 'Cisco', '00:25:46': 'Cisco', '00:25:83': 'Cisco',
  '00:25:84': 'Cisco', '00:26:0a': 'Cisco', '00:26:0b': 'Cisco', '00:26:51': 'Cisco',
  '00:26:52': 'Cisco', '00:26:99': 'Cisco', '00:26:cb': 'Cisco', '00:26:cc': 'Cisco',
  '00:27:0c': 'Cisco', '00:27:0d': 'Cisco', '00:1b:d4': 'Cisco', '04:62:73': 'Cisco',
  '04:6c:9d': 'Cisco', '08:80:39': 'Cisco', '0c:27:24': 'Cisco', '0c:75:bd': 'Cisco',
  '0c:d9:96': 'Cisco', '10:ea:59': 'Cisco', '1c:de:a7': 'Cisco', '24:01:c7': 'Cisco',
  '40:55:39': 'Cisco', '5c:a4:8a': 'Cisco', '64:9e:f3': 'Cisco', '7c:0e:ce': 'Cisco',
  '7c:69:f6': 'Cisco', '88:5a:92': 'Cisco', 'a0:e0:af': 'Cisco', 'a4:0c:c3': 'Cisco',
  'b0:7d:47': 'Cisco', 'b4:14:89': 'Cisco', 'bc:16:65': 'Cisco', 'c0:67:af': 'Cisco',
  'c4:14:3c': 'Cisco', 'cc:5a:53': 'Cisco', 'd0:c2:82': 'Cisco', 'd4:78:9b': 'Cisco',
  'e0:2f:6d': 'Cisco', 'e8:ed:f3': 'Cisco', 'f4:1f:c2': 'Cisco', 'f8:c2:88': 'Cisco',

  // Juniper
  '00:05:85': 'Juniper', '00:10:db': 'Juniper', '00:12:1e': 'Juniper', '00:14:f6': 'Juniper',
  '00:17:cb': 'Juniper', '00:19:e2': 'Juniper', '00:1b:c0': 'Juniper', '00:1d:b5': 'Juniper',
  '00:1f:12': 'Juniper', '00:21:59': 'Juniper', '00:22:83': 'Juniper', '00:23:9c': 'Juniper',
  '00:24:dc': 'Juniper', '00:26:88': 'Juniper', '00:31:46': 'Juniper', '00:90:69': 'Juniper',
  '28:8a:1c': 'Juniper', '28:c0:da': 'Juniper', '2c:21:31': 'Juniper', '2c:6b:f5': 'Juniper',
  '30:7c:5e': 'Juniper', '3c:61:04': 'Juniper', '3c:8a:b0': 'Juniper', '3c:94:d5': 'Juniper',
  '40:71:83': 'Juniper', '44:aa:50': 'Juniper', '4c:16:fc': 'Juniper', '4c:96:14': 'Juniper',
  '50:c5:8d': 'Juniper', '54:1e:56': 'Juniper', '54:e0:32': 'Juniper', '5c:5e:ab': 'Juniper',
  '64:64:9b': 'Juniper', '64:87:88': 'Juniper', '78:19:f7': 'Juniper', '78:fe:3d': 'Juniper',
  '80:71:1f': 'Juniper', '80:ac:ac': 'Juniper', '84:18:88': 'Juniper', '84:b5:9c': 'Juniper',
  '88:a2:5e': 'Juniper', '88:e0:f3': 'Juniper', '8c:fe:5c': 'Juniper', 'b0:a8:6e': 'Juniper',
  'c4:73:1e': 'Juniper', 'cc:e1:7f': 'Juniper', 'd4:04:ff': 'Juniper', 'dc:38:e1': 'Juniper',
  'e4:5d:37': 'Juniper', 'e8:a7:36': 'Juniper', 'ec:13:db': 'Juniper', 'ec:3e:f7': 'Juniper',
  'f0:1c:2d': 'Juniper', 'f4:b5:2f': 'Juniper', 'f4:cc:55': 'Juniper', 'f8:c0:01': 'Juniper',
  'fc:00:12': 'Juniper',

  // Arista
  '00:1c:73': 'Arista', '28:99:3a': 'Arista', '2c:dd:e9': 'Arista', '44:4c:a8': 'Arista',
  '50:87:89': 'Arista', '74:83:ef': 'Arista', '74:bd:af': 'Arista', '78:88:ee': 'Arista',
  '7c:75:b1': 'Arista', '98:5d:82': 'Arista', '98:f2:b3': 'Arista', 'a0:36:9f': 'Arista',
  'bc:2c:e6': 'Arista', 'c4:ca:2b': 'Arista', 'd4:af:f7': 'Arista', 'fc:bd:67': 'Arista',

  // HPE / Aruba / HP
  '00:01:e6': 'HP', '00:01:e7': 'HP', '00:08:c7': 'HP', '00:0a:57': 'HP',
  '00:0b:cd': 'HP', '00:0e:7f': 'HP', '00:0f:20': 'HP', '00:10:83': 'HP',
  '00:11:0a': 'HP', '00:11:85': 'HP', '00:12:79': 'HP', '00:13:21': 'HP',
  '00:14:38': 'HP', '00:14:c2': 'HP', '00:15:60': 'HP', '00:16:35': 'HP',
  '00:17:08': 'HP', '00:17:a4': 'HP', '00:18:71': 'HP', '00:18:fe': 'HP',
  '00:19:bb': 'HP', '00:1a:4b': 'HP', '00:1b:78': 'HP', '00:1c:c4': 'HP',
  '00:1e:0b': 'HP', '00:1f:29': 'HP', '00:21:5a': 'HP', '00:22:64': 'HP',
  '00:23:7d': 'HP', '00:24:81': 'HP', '00:25:b3': 'HP', '00:26:55': 'HP',
  '00:0b:86': 'Aruba', '04:bd:88': 'Aruba', '18:64:72': 'Aruba', '20:4c:03': 'Aruba',
  '24:de:c6': 'Aruba', '40:e3:d6': 'Aruba', '6c:f3:7f': 'Aruba', '70:3a:0e': 'Aruba',
  '94:b4:0f': 'Aruba', '9c:1c:12': 'Aruba', 'ac:a3:1e': 'Aruba', 'd8:c7:c8': 'Aruba',
  'f0:5c:19': 'Aruba',

  // Dell
  '00:06:5b': 'Dell', '00:08:74': 'Dell', '00:0b:db': 'Dell', '00:0d:56': 'Dell',
  '00:0f:1f': 'Dell', '00:11:43': 'Dell', '00:12:3f': 'Dell', '00:13:72': 'Dell',
  '00:14:22': 'Dell', '00:15:c5': 'Dell', '00:16:f0': 'Dell', '00:18:8b': 'Dell',
  '00:19:b9': 'Dell', '00:1a:a0': 'Dell', '00:1c:23': 'Dell', '00:1d:09': 'Dell',
  '00:1e:4f': 'Dell', '00:1e:c9': 'Dell', '00:21:70': 'Dell', '00:21:9b': 'Dell',
  '00:22:19': 'Dell', '00:23:ae': 'Dell', '00:24:e8': 'Dell', '00:25:64': 'Dell',
  '00:26:b9': 'Dell', '14:18:77': 'Dell', '14:fe:b5': 'Dell', '18:03:73': 'Dell',
  '18:66:da': 'Dell', '18:a9:9b': 'Dell', '18:db:f2': 'Dell', '20:04:0f': 'Dell',
  '24:6e:96': 'Dell', '24:b6:fd': 'Dell', '34:17:eb': 'Dell', '50:9a:4c': 'Dell',
  '64:00:6a': 'Dell', '74:86:7a': 'Dell', '78:2b:cb': 'Dell', '78:45:c4': 'Dell',
  '84:7b:eb': 'Dell', '90:b1:1c': 'Dell', 'b0:83:fe': 'Dell', 'b4:e1:0f': 'Dell',
  'b8:2a:72': 'Dell', 'b8:ac:6f': 'Dell', 'b8:ca:3a': 'Dell', 'bc:30:5b': 'Dell',
  'c8:1f:66': 'Dell', 'd0:67:e5': 'Dell', 'd4:ae:52': 'Dell', 'd4:be:d9': 'Dell',
  'e0:db:55': 'Dell', 'f0:1f:af': 'Dell', 'f0:4d:a2': 'Dell', 'f4:8e:38': 'Dell',
  'f8:b1:56': 'Dell', 'f8:bc:12': 'Dell', 'f8:db:88': 'Dell',

  // VMware (virtual NICs)
  '00:05:69': 'VMware', '00:0c:29': 'VMware', '00:1c:14': 'VMware', '00:50:56': 'VMware',

  // Microsoft Hyper-V / Surface / Xbox
  '00:03:ff': 'Microsoft', '00:0d:3a': 'Microsoft', '00:12:5a': 'Microsoft',
  '00:15:5d': 'Microsoft', '00:17:fa': 'Microsoft', '00:1d:d8': 'Microsoft',
  '00:22:48': 'Microsoft', '00:25:ae': 'Microsoft', '00:50:f2': 'Microsoft',

  // Apple
  '00:03:93': 'Apple', '00:05:02': 'Apple', '00:0a:27': 'Apple', '00:0a:95': 'Apple',
  '00:0d:93': 'Apple', '00:10:fa': 'Apple', '00:11:24': 'Apple', '00:14:51': 'Apple',
  '00:16:cb': 'Apple', '00:17:f2': 'Apple', '00:19:e3': 'Apple', '00:1b:63': 'Apple',
  '00:1c:b3': 'Apple', '00:1d:4f': 'Apple', '00:1e:52': 'Apple', '00:1e:c2': 'Apple',
  '00:1f:5b': 'Apple', '00:1f:f3': 'Apple', '00:21:e9': 'Apple', '00:22:41': 'Apple',
  '00:23:12': 'Apple', '00:23:32': 'Apple', '00:23:6c': 'Apple', '00:23:df': 'Apple',
  '00:24:36': 'Apple', '00:25:00': 'Apple', '00:25:4b': 'Apple', '00:25:bc': 'Apple',
  '00:26:08': 'Apple', '00:26:4a': 'Apple', '00:26:b0': 'Apple', '00:26:bb': 'Apple',
  '04:0c:ce': 'Apple', '04:1e:64': 'Apple', '04:48:9a': 'Apple', '04:54:53': 'Apple',
  '04:db:56': 'Apple', '04:f1:3e': 'Apple', '04:f7:e4': 'Apple', '08:66:98': 'Apple',
  '14:10:9f': 'Apple', '1c:1a:c0': 'Apple', '20:c9:d0': 'Apple', '28:cf:e9': 'Apple',
  '34:15:9e': 'Apple', '3c:07:54': 'Apple', '40:a6:d9': 'Apple', '48:74:6e': 'Apple',
  '4c:b1:99': 'Apple', '58:55:ca': 'Apple', '5c:f9:38': 'Apple', '64:b9:e8': 'Apple',
  '6c:70:9f': 'Apple', '70:cd:60': 'Apple', '70:de:e2': 'Apple', '78:7e:61': 'Apple',
  '7c:6d:62': 'Apple', '7c:c3:a1': 'Apple', '80:ea:96': 'Apple', '84:38:35': 'Apple',
  '88:53:95': 'Apple', '8c:58:77': 'Apple', '90:27:e4': 'Apple', '90:b2:1f': 'Apple',
  '98:01:a7': 'Apple', '9c:f3:87': 'Apple', 'a4:5e:60': 'Apple', 'a8:20:66': 'Apple',
  'a8:51:ab': 'Apple', 'a8:88:08': 'Apple', 'ac:bc:32': 'Apple', 'b8:17:c2': 'Apple',
  'b8:8d:12': 'Apple', 'bc:52:b7': 'Apple', 'bc:92:6b': 'Apple', 'c4:b3:01': 'Apple',
  'c8:bc:c8': 'Apple', 'd0:23:db': 'Apple', 'd4:9a:20': 'Apple', 'd8:1d:72': 'Apple',
  'dc:2b:2a': 'Apple', 'e0:f8:47': 'Apple', 'e4:c6:3d': 'Apple', 'f0:c1:f1': 'Apple',
  'f4:0f:24': 'Apple', 'f8:1e:df': 'Apple',

  // Intel
  '00:02:b3': 'Intel', '00:03:47': 'Intel', '00:04:23': 'Intel', '00:07:e9': 'Intel',
  '00:0c:f1': 'Intel', '00:0e:0c': 'Intel', '00:0e:35': 'Intel', '00:11:11': 'Intel',
  '00:12:f0': 'Intel', '00:13:02': 'Intel', '00:13:20': 'Intel', '00:13:ce': 'Intel',
  '00:13:e8': 'Intel', '00:15:00': 'Intel', '00:15:17': 'Intel', '00:16:6f': 'Intel',
  '00:16:76': 'Intel', '00:16:ea': 'Intel', '00:16:eb': 'Intel', '00:18:de': 'Intel',
  '00:19:d1': 'Intel', '00:19:d2': 'Intel', '00:1b:21': 'Intel', '00:1b:77': 'Intel',
  '00:1c:bf': 'Intel', '00:1c:c0': 'Intel', '00:1d:e0': 'Intel', '00:1d:e1': 'Intel',
  '00:1e:64': 'Intel', '00:1e:65': 'Intel', '00:1e:67': 'Intel', '00:1f:3b': 'Intel',
  '00:1f:3c': 'Intel', '00:21:5c': 'Intel', '00:21:5d': 'Intel', '00:21:6a': 'Intel',
  '00:21:6b': 'Intel', '00:22:fa': 'Intel', '00:22:fb': 'Intel', '00:23:14': 'Intel',
  '00:23:15': 'Intel', '00:24:d6': 'Intel', '00:24:d7': 'Intel', '00:26:c6': 'Intel',
  '00:26:c7': 'Intel', '00:27:0e': 'Intel', '00:27:10': 'Intel',

  // F5
  '00:01:d7': 'F5', '00:94:a1': 'F5',

  // A10 Networks
  '00:1f:a4': 'A10',

  // Palo Alto
  '00:1b:17': 'Palo Alto', '08:30:6b': 'Palo Alto', 'b4:0c:25': 'Palo Alto',

  // Fortinet
  '00:09:0f': 'Fortinet', '04:d5:90': 'Fortinet', '70:4c:a5': 'Fortinet',
  '90:6c:ac': 'Fortinet', 'e8:1c:ba': 'Fortinet',

  // Nutanix
  '50:6b:8d': 'Nutanix', 'ac:1f:6b': 'Nutanix',

  // Mellanox / NVIDIA
  '00:02:c9': 'Mellanox', '24:8a:07': 'Mellanox', 'b8:59:9f': 'Mellanox',
  'ec:0d:9a': 'Mellanox', '04:3f:72': 'NVIDIA', '48:b0:2d': 'NVIDIA',

  // Broadcom / Realtek (NICs)
  '00:10:18': 'Broadcom', '14:e6:e4': 'Broadcom',
  '00:e0:4c': 'Realtek', '52:54:00': 'QEMU/KVM',

  // 6WIND (matches your topology)
  '00:25:c2': '6WIND',
};

export function ouiVendor(mac: string): string | null {
  if (!mac || !isMAC(mac)) return null;
  const prefix = normaliseMAC(mac).slice(0, 8);
  return OUI[prefix] ?? null;
}
