using Components.Scripting;

namespace Components.ModInstaller
{
    public class ModFormatManager
    {

        #region Fields

        #endregion

        #region Properties

        protected IScriptTypeRegistry CurrentScriptTypeRegistry;

        #endregion

        #region Costructors

        public ModFormatManager()
        {
            // ??? Dummy path
            CurrentScriptTypeRegistry = ScriptTypeRegistry.DiscoverScriptTypes("InstallScripts");
        }

        #endregion

    }
}
