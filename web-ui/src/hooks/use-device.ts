import { useQuery } from '@tanstack/react-query';
import { getDeviceDetails, getDevicePorts, getDeviceNodes, getDeviceVlans, getDeviceModules, getDeviceLog, getDeviceAddresses, getDeviceNeighbors, getPortProperties, getDevicePoweredPorts } from '@/api/devices';

export function useDeviceDetails(ip: string) {
  return useQuery({ queryKey: ['device', ip, 'details'], queryFn: () => getDeviceDetails(ip) });
}
export function useDevicePorts(ip: string)     { return useQuery({ queryKey: ['device', ip, 'ports'],     queryFn: () => getDevicePorts(ip) }); }
export function useDeviceNodes(ip: string)     { return useQuery({ queryKey: ['device', ip, 'nodes'],     queryFn: () => getDeviceNodes(ip) }); }
export function useDeviceVlans(ip: string)     { return useQuery({ queryKey: ['device', ip, 'vlans'],     queryFn: () => getDeviceVlans(ip) }); }
export function useDeviceModules(ip: string)   { return useQuery({ queryKey: ['device', ip, 'modules'],   queryFn: () => getDeviceModules(ip) }); }
export function useDeviceLog(ip: string)       { return useQuery({ queryKey: ['device', ip, 'log'],       queryFn: () => getDeviceLog(ip) }); }
export function useDeviceAddresses(ip: string) { return useQuery({ queryKey: ['device', ip, 'addresses'], queryFn: () => getDeviceAddresses(ip) }); }
export function useDeviceNeighbors(ip: string) { return useQuery({ queryKey: ['device', ip, 'neighbors'], queryFn: () => getDeviceNeighbors(ip), retry: false }); }
export function useDevicePoweredPorts(ip: string) { return useQuery({ queryKey: ['device', ip, 'powered_ports'], queryFn: () => getDevicePoweredPorts(ip), retry: false }); }
export function usePortProperties(ip: string, port: string) {
  return useQuery({ queryKey: ['device', ip, 'port', port, 'properties'], queryFn: () => getPortProperties(ip, port), enabled: !!port, retry: false });
}
