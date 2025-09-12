const { getAllWindowsDrivePaths, getCrossoverPaths, getParallelsPaths, getVMwarePaths, getVirtualBoxPaths } = require('../src/util/macVirtualization');
const fs = require('fs-extra');
const path = require('path');

jest.mock('fs-extra');

describe('macVirtualization', () => {
  const mockHomeDir = '/Users/testuser';
  
  beforeEach(() => {
    process.env.HOME = mockHomeDir;
    // Reset mocks including implementations and queued mockResolvedValueOnce values
    jest.resetAllMocks();
  });

  describe('getCrossoverPaths', () => {
    it('should return empty array when HOME is not set', async () => {
      delete process.env.HOME;
      const result = await getCrossoverPaths();
      expect(result).toEqual([]);
    });

    it('should check for Crossover installation and return bottle paths', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue(['Bottle1', 'Bottle2']);
      
      const result = await getCrossoverPaths();
      
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'Applications', 'Crossover'));
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles'));
      expect(fs.readdir).toHaveBeenCalledWith(path.join(mockHomeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles'));
      expect(result).toEqual([
        path.join(mockHomeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles', 'Bottle1'),
        path.join(mockHomeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles', 'Bottle2')
      ]);
    });

    it('should return empty array when Crossover is not installed', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      const result = await getCrossoverPaths();
      
      expect(result).toEqual([]);
    });
  });

  describe('getParallelsPaths', () => {
    it('should return empty array when HOME is not set', async () => {
      delete process.env.HOME;
      const result = await getParallelsPaths();
      expect(result).toEqual([]);
    });

    it('should check for Parallels installation and return VM paths', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue(['VM1.pvm', 'VM2.pvm', 'not-a-vm']);
      
      const result = await getParallelsPaths();
      
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'Applications', 'Parallels'));
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'Parallels'));
      expect(fs.readdir).toHaveBeenCalledWith(path.join(mockHomeDir, 'Parallels'));
      expect(result).toEqual([
        path.join(mockHomeDir, 'Parallels', 'VM1.pvm'),
        path.join(mockHomeDir, 'Parallels', 'VM2.pvm')
      ]);
    });

    it('should return empty array when Parallels is not installed', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      const result = await getParallelsPaths();
      
      expect(result).toEqual([]);
    });
  });

  describe('getVMwarePaths', () => {
    it('should return empty array when HOME is not set', async () => {
      delete process.env.HOME;
      const result = await getVMwarePaths();
      expect(result).toEqual([]);
    });

    it('should check for VMware Fusion installation and return VM paths', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir
        .mockResolvedValueOnce(['VM1.vmwarevm', 'VM2.vmwarevm', 'not-a-vm']) // Documents/Virtual Machines
        .mockResolvedValueOnce([]); // ~/Virtual Machines (legacy)
      
      const result = await getVMwarePaths();
      
      expect(fs.pathExists).toHaveBeenCalledWith('/Applications/VMware Fusion.app');
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'Documents', 'Virtual Machines'));
      expect(fs.readdir).toHaveBeenCalledWith(path.join(mockHomeDir, 'Documents', 'Virtual Machines'));
      expect(result).toEqual([
        path.join(mockHomeDir, 'Documents', 'Virtual Machines', 'VM1.vmwarevm'),
        path.join(mockHomeDir, 'Documents', 'Virtual Machines', 'VM2.vmwarevm')
      ]);
    });

    it('should check legacy VMware paths', async () => {
      fs.pathExists
        .mockResolvedValueOnce(false) // /Applications/VMware Fusion.app
        .mockResolvedValueOnce(false) // ~/Applications/VMware Fusion.app
        .mockResolvedValueOnce(true) // ~/Documents/Virtual Machines
        .mockResolvedValueOnce(false) // ~/Virtual Machines
        .mockResolvedValueOnce(true); // ~/Virtual Machines (exists)
      
      fs.readdir
        .mockResolvedValueOnce([]) // Documents/Virtual Machines (empty)
        .mockResolvedValueOnce(['VM3.vmwarevm']); // ~/Virtual Machines
      
      const result = await getVMwarePaths();
      
      expect(result).toEqual([
        path.join(mockHomeDir, 'Virtual Machines', 'VM3.vmwarevm')
      ]);
    });

    it('should return empty array when VMware Fusion is not installed', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      const result = await getVMwarePaths();
      
      expect(result).toEqual([]);
    });
  });

  describe('getVirtualBoxPaths', () => {
    it('should return empty array when HOME is not set', async () => {
      delete process.env.HOME;
      const result = await getVirtualBoxPaths();
      expect(result).toEqual([]);
    });

    it('should check for VirtualBox installation and return VM paths', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue(['VM1', 'VM2']);
      
      const result = await getVirtualBoxPaths();
      
      expect(fs.pathExists).toHaveBeenCalledWith('/Applications/VirtualBox.app');
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(mockHomeDir, 'VirtualBox VMs'));
      expect(fs.readdir).toHaveBeenCalledWith(path.join(mockHomeDir, 'VirtualBox VMs'));
      expect(result).toEqual([
        path.join(mockHomeDir, 'VirtualBox VMs', 'VM1'),
        path.join(mockHomeDir, 'VirtualBox VMs', 'VM2')
      ]);
    });

    it('should return empty array when VirtualBox is not installed', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      const result = await getVirtualBoxPaths();
      
      expect(result).toEqual([]);
    });
  });

  describe('getAllWindowsDrivePaths', () => {
    it('should return standard paths and virtualization paths', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir
        .mockResolvedValueOnce(['Bottle1']) // Crossover bottles
        .mockResolvedValueOnce(['VM1.pvm']) // Parallels VMs
        .mockResolvedValueOnce(['VM2.vmwarevm']) // VMware VMs
        .mockResolvedValueOnce(['VM3']) // VirtualBox VMs
        .mockResolvedValueOnce([]) // External mount points
        .mockResolvedValueOnce([]) // External mount points
        .mockResolvedValueOnce([]) // External mount points
        .mockResolvedValueOnce([]); // External mount points
      
      const result = await getAllWindowsDrivePaths();
      
      expect(result).toContain('/');
      expect(result).toContain(path.join(mockHomeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles', 'Bottle1', 'drive_c'));
      expect(result).toContain(path.join(mockHomeDir, 'Parallels', 'Shared Folders'));
      expect(result).toContain(path.join(mockHomeDir, 'Documents', 'Virtual Machines', 'VM2.vmwarevm', 'Shared Folders'));
      expect(result).toContain(path.join(mockHomeDir, 'VirtualBox VMs', 'VM3', 'SharedFolder'));
      expect(result).toContain('/Volumes');
      expect(result).toContain(path.join(mockHomeDir, 'Desktop'));
      expect(result).toContain(path.join(mockHomeDir, 'Documents'));
    });
  });
});