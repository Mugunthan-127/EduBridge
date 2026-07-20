/**
 * @see kolibri/core/discovery/models.py:ConnectionStatus
 */
export const ConnectionStatus = {
  Unknown: 'Unknown',
  ConnectionFailure: 'ConnectionFailure',
  ResponseTimeout: 'ResponseTimeout',
  ResponseFailure: 'ResponseFailure',
  InvalidResponse: 'InvalidResponse',
  Conflict: 'Conflict',
};

export const UnreachableConnectionStatuses = [
  ConnectionStatus.ConnectionFailure,
  ConnectionStatus.ResponseTimeout,
];

export const LocationTypes = {
  // reserved locations like Studio and KDP
  RESERVED: 'reserved',
  // static locations added by the user
  STATIC: 'static',
  // dynamic locations discovered by the Kolibri instance
  DYNAMIC: 'dynamic',
};
