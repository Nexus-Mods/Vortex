export type RequestCommand = 'IsPatchApplicable' | 'ApplyPatch' |
  'RemovePatch' | 'DeployVML' | 'PurgeVML' | 'EnableReflection' |
  'DisableReflection' | 'DeployVIGO' | 'PurgeVIGO' | 'Reply' | 'Quit';

// Defines a source/target entry point.
export interface IEntryPoint {
  // Absolute path to the assembly holding the type and method.
  AssemblyPath: string;

  // Namespace.Classname
  TypeName: string;

  // Name of the method.
  MethodName: string;

  // A dependency path for the injector to resolve paths to any "missing" assemblies
  //  the dataPath provided through the delegates will be searched as well.
  DependencyPath?: string;

  // Additional information such as arguments for the method call can also be sent.
  //  this needs to be a serialized JSON string.
  ExpandoObjectData?: string;
}

// The Injector expects a patch configuration to
//  be provided for all injection requests.
export interface IPatchConfig {
  // Id of this patch request.
  Id?: string;

  // Tell the injector what we want to do.
  Command: RequestCommand;

  // The directory path to the calling extension.
  ExtensionPath: string;

  // Used to find the type::method call we want to inject
  //  into other entry points.
  SourceEntryPoint: IEntryPoint;

  // Injector will try to inject the source entry point
  //  into all provided target entry points.
  TargetEntryPoints: IEntryPoint[];
}

// Refers to the details provided in game extensions
//  which are generally used by the harmony mod-type.
export interface IPatcherDetails {
  // Usually where the game holds its assemblies.
  dataPath: string;

  // The legacy way of defining an entry point.
  entryPoint: string;

  // Where we store our mods.
  modsPath: string;

  // Whether the game extension requires us to inject VIGO.
  injectVIGO: boolean;
}
