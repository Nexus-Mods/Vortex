using System;
using System.Runtime.InteropServices;

namespace DotNetProbe
{
    class Program
    {
        static int Main(string[] args)
        {
            try
            {
                // This program is compiled against .NET 9.0 Desktop Runtime
                // If it runs successfully, it means the required runtime is installed

                var runtimeVersion = RuntimeInformation.FrameworkDescription;
                var osDescription = RuntimeInformation.OSDescription;

                // Verify we're running on .NET 9.0 or higher
                var version = Environment.Version;
                if (version.Major >= 9)
                {
                    Console.WriteLine("Success");
                    return 0;
                }
                else
                {
                    Console.Error.WriteLine($"Error: .NET 9.0 or higher required, but found {runtimeVersion}");
                    return 1;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error: {ex.Message}");
                return 1;
            }
        }
    }
}