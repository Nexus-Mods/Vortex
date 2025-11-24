using System;

namespace DotNetProbe;

public static class Program
{
    public static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine($"Error: not enough arguments, expected 2 received {args.Length}");
            return 1;
        }

        var rawMinimumVersion = args[0];
        if (!int.TryParse(rawMinimumVersion, out var minimumVersion))
        {
            Console.Error.WriteLine($"Error: failed to parse '{rawMinimumVersion}' as integer");
            return 1;
        }

        try
        {
            var dotnetRuntimeVersion = Environment.Version;
            if (dotnetRuntimeVersion.Major < minimumVersion)
            {
                Console.Error.WriteLine($"Error: Requires .NET {minimumVersion} or higher but found .NET {dotnetRuntimeVersion}");
                return 1;
            }

            Console.WriteLine($"Success: Found .NET {dotnetRuntimeVersion}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            return 1;
        }
    }
}