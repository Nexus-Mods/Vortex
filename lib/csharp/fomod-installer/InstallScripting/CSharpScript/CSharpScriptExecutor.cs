using System;
using System.CodeDom.Compiler;
using System.Collections.Generic;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using FomodInstaller.Interface;
using System.Diagnostics;
using System.Security;
using System.Security.Permissions;
using System.Security.Policy;
using System.IO;

namespace FomodInstaller.Scripting.CSharpScript
{
    /// <summary>
    /// Executes a C# script.
    /// </summary>
    public class CSharpScriptExecutor : ScriptExecutorBase
    {

        private static Regex m_regScriptClass = new Regex(@"(class\s+Script\s*:.*?)(\S*BaseScript)");
        private static Regex m_regFommUsing = new Regex(@"\s*using\s*fomm.Scripting\s*;");
        private CSharpScriptFunctionProxy m_csfFunctions = null;

        #region Properties

        /// <summary>
        /// Gets the type of the base script for all C# scripts.
        /// </summary>
        /// <value>The type of the base script for all C# scripts.</value>
        protected Type BaseScriptType { get; private set; }

        #endregion

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        public CSharpScriptExecutor(CSharpScriptFunctionProxy p_csfFunctions, Type p_typBaseScriptType)
        {
            m_csfFunctions = p_csfFunctions;
            BaseScriptType = p_typBaseScriptType;
        }

        #endregion

        #region ScriptExecutorBase Members

        /// <summary>
        /// Executes the script.
        /// </summary>
        /// <param name="p_scpScript">The C# Script to execute.</param>
        /// <param name="p_strDataPath">Path where data for this script (i.e. screenshots) is stored.</param>
        /// <returns><c>true</c> if the script completes successfully;
        /// <c>false</c> otherwise.</returns>
        /// <exception cref="ArgumentException">Thrown if <paramref name="p_scpScript"/> is not a
        /// <see cref="CSharpScript"/>.</exception>
        public override Task<IList<Instruction>> DoExecute(IScript p_scpScript, string p_strDataPath)
        {
            if (!(p_scpScript is CSharpScript))
                throw new ArgumentException("The given script must be of type CSharpScript.", "p_scpScript");

            CSharpScript cscScript = (CSharpScript)p_scpScript;

            byte[] bteScript = Compile(cscScript.Code);
            if (bteScript == null)
                return null;

            IList<Instruction> instructions = new List<Instruction>();
            m_csfFunctions.SetInstructionContainer(instructions);

            AppDomain admScript = CreateSandbox(p_scpScript, p_strDataPath);
            object[] args = { m_csfFunctions };
            AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(CurrentDomain_AssemblyResolve);
            ScriptRunner srnRunner = null;
            try
            {
                srnRunner = (ScriptRunner)admScript.CreateInstanceFromAndUnwrap(typeof(ScriptRunner).Assembly.ManifestModule.FullyQualifiedName, typeof(ScriptRunner).FullName, false, BindingFlags.Default, null, args, null, null);
            }
            catch (Exception e)
            {
                // TODO rethrow because the transition layer to js seems to have trouble serializing the original exception
                //   of course we want to maintain more of the error message and this shouldn't be here but closer to the
                //   "edge".
                throw new Exception("failed to create runner: " + e.GetType().ToString() + "\n" + e.Message + "\n" + e.StackTrace + "\n" + e.Data.ToString());
            }
            finally
            {
                //AppDomain.CurrentDomain.AssemblyResolve -= CurrentDomain_AssemblyResolve;
            }
            return Task.Run(() =>
            {
                bool res = srnRunner.Execute(bteScript);
                AppDomain.CurrentDomain.AssemblyResolve -= CurrentDomain_AssemblyResolve;
                AppDomain.Unload(admScript);
                if (!res)
                {
                    return null;
                }
                else
                {
                    return instructions;
                }
            });
        }

        #endregion

        /// <summary>
        /// Handles the <see cref="AppDomain.AssemblyResolve"/> event.
        /// </summary>
        /// <remarks>
        /// Assemblies that have been load dynamically aren't accessible by assembly name. So, when, for example,
        /// this class looks for the assembly containing the ScriptRunner type that was CreateInstanceFromAndUnwrap-ed,
        /// the class can't find the type. This handler searches through loaded assemblies and finds the required assembly.
        /// </remarks>
        /// <param name="sender">The object that raised the event.</param>
        /// <param name="args">A <see cref="ResolveEventArgs"/> describing the event arguments.</param>
        /// <returns>The assembly being looked for, or <c>null</c> if the assembly cannot
        /// be found.</returns>
        private Assembly CurrentDomain_AssemblyResolve(object sender, ResolveEventArgs args)
        {
            foreach (Assembly asmLoaded in AppDomain.CurrentDomain.GetAssemblies())
                if (asmLoaded.FullName == args.Name)
                    return asmLoaded;
            return null;
        }

        /// <summary>
        /// Compiles the given C# script code.
        /// </summary>
        /// <remarks>
        /// The compiled script is not loaded into the current domain.
        /// </remarks>
        /// <param name="p_strCode">The code to compile.</param>
        /// <returns>The bytes of the assembly containing the script to execute.</returns>
        protected byte[] Compile(string p_strCode)
        {
            CSharpScriptCompiler sccCompiler = new CSharpScriptCompiler();
            CompilerErrorCollection cecErrors = null;

            string strBaseScriptClassName = m_regScriptClass.Match(p_strCode).Groups[2].ToString();
            string strCode = m_regScriptClass.Replace(p_strCode, "using " + BaseScriptType.Namespace + ";\r\n$1" + BaseScriptType.Name);
            Regex regOtherScriptClasses = new Regex(string.Format(@"(class\s+\S+\s*:.*?)(?<!\w){0}", strBaseScriptClassName));
            strCode = regOtherScriptClasses.Replace(strCode, "$1" + BaseScriptType.Name);
            strCode = m_regFommUsing.Replace(strCode, "");
            byte[] bteAssembly = sccCompiler.Compile(strCode, BaseScriptType, out cecErrors);

            if (cecErrors != null)
            {
                StringBuilder stbErrors = new StringBuilder();
                if (cecErrors.HasErrors)
                {
                    stbErrors.Append("<h3 style='color:red'>Errors</h3><ul>");
                    foreach (CompilerError cerError in cecErrors)
                        if (!cerError.IsWarning)
                            stbErrors.AppendFormat("<li><b>{0},{1}:</b> {2} <i>(Error {3})</i></li>", cerError.Line, cerError.Column, cerError.ErrorText, cerError.ErrorNumber);
                    stbErrors.Append("</ul>");
                }
                if (cecErrors.HasWarnings)
                {
                    stbErrors.Append("<h3 style='color:#ffd700;'>Warnings</h3><ul>");
                    foreach (CompilerError cerError in cecErrors)
                        if (cerError.IsWarning)
                            stbErrors.AppendFormat("<li><b>{0},{1}:</b> {2} <i>(Error {3})</i></li>", cerError.Line, cerError.Column, cerError.ErrorText, cerError.ErrorNumber);
                    stbErrors.Append("</ul>");
                }
                if (cecErrors.HasErrors)
                {
                    string strMessage = "Could not compile script; errors were found.";
                    m_csfFunctions.ExtendedMessageBox(strMessage, "Error", stbErrors.ToString());
                    return null;
                }
            }
            return bteAssembly;
        }

        /// <summary>
        /// Creates a sandboxed domain.
        /// </summary>
        /// <remarks>
        /// The sandboxed domain is only given permission to alter the parts of the system
        /// that are relevant to mod management for the current game mode.
        /// </remarks>
        /// <param name="p_scpScript">The script we are going to execute. This is required so we can include
        /// the folder containing the script's script type class in the sandboxes PrivateBinPath.
        /// We need to do this so that any helper classes and libraries used by the script
        /// can be found.</param>
        /// <param name="p_strDataPath">path where data for this script is stored. The sandbox will
        /// allow read-access to this (and only this) directory</param>
        /// <returns>A sandboxed domain.</returns>
        protected AppDomain CreateSandbox(IScript p_scpScript, string p_strDataPath)
        {
            Trace.TraceInformation("Creating C# Script Sandbox...");
            Trace.Indent();

            Evidence eviSecurityInfo = null;
            AppDomainSetup adsInfo = new AppDomainSetup();
            //should this be different from the current ApplicationBase?
            adsInfo.ApplicationBase = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            ISet<string> setPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            Type tpeBaseScript = BaseScriptType;
            while ((tpeBaseScript != null) && (tpeBaseScript != typeof(object)))
            {
                setPaths.Add(Path.GetDirectoryName(Assembly.GetAssembly(tpeBaseScript).Location));
                tpeBaseScript = tpeBaseScript.BaseType;
            }
            Type tpeScript = p_scpScript.Type.GetType();
            while ((tpeScript != null) && (tpeScript != typeof(object)))
            {
                setPaths.Add(Path.GetDirectoryName(Assembly.GetAssembly(tpeScript).Location));
                tpeScript = tpeScript.BaseType;
            }
            adsInfo.PrivateBinPath = string.Join(";", setPaths.GetEnumerator());

            Trace.TraceInformation("ApplicationBase: {0}", adsInfo.ApplicationBase);
            Trace.TraceInformation("PrivateBinPath: {0}", adsInfo.PrivateBinPath);

            adsInfo.ApplicationName = "ScriptRunner";
            adsInfo.DisallowBindingRedirects = true;
            adsInfo.DisallowCodeDownload = true;
            adsInfo.DisallowPublisherPolicy = true;
            PermissionSet pstGrantSet = new PermissionSet(PermissionState.None);
            pstGrantSet.AddPermission(new SecurityPermission(SecurityPermissionFlag.Execution));
            pstGrantSet.AddPermission(new ReflectionPermission(ReflectionPermissionFlag.RestrictedMemberAccess));

            //need access to path with modinstaller binaries so the script can load the script assembly
            pstGrantSet.AddPermission(new FileIOPermission(FileIOPermissionAccess.PathDiscovery, adsInfo.ApplicationBase));
            pstGrantSet.AddPermission(new FileIOPermission(FileIOPermissionAccess.Read, adsInfo.ApplicationBase));

            //It's not clear to me if these permissions are dangerous
            pstGrantSet.AddPermission(new UIPermission(UIPermissionClipboard.NoClipboard));
            pstGrantSet.AddPermission(new UIPermission(UIPermissionWindow.AllWindows));
            pstGrantSet.AddPermission(new MediaPermission(MediaPermissionImage.SafeImage));

            //add the specific permissions the script will need
            pstGrantSet.AddPermission(new FileIOPermission(FileIOPermissionAccess.Read, p_strDataPath));
            pstGrantSet.AddPermission(new FileIOPermission(FileIOPermissionAccess.PathDiscovery, p_strDataPath));

            Trace.Unindent();

            return AppDomain.CreateDomain("ScriptRunnerDomain", eviSecurityInfo, adsInfo, pstGrantSet);
        }
    }
}
