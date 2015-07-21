//
//  ONMSCloudStorage.m
//  Cordova Cloud Storage Plugin
//
//  Created by Benjamin Reed on 7/20/15.
//
//

#import "ONMSCloudStorage.h"

@implementation ONMSCloudStorage

- (void) onmsGetJsonFileContents:(CDVInvokedUrlCommand *)command {
  NSString *filePath = [command.arguments objectAtIndex:0];

  NSError *error = nil;
  NSData *data = [self readFile:filePath synced:@YES error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }

  NSDictionary *jsonData = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }
  
  NSDictionary *jsonObj = [
                           [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           jsonData, @"contents",
                           @YES, @"success",
                           nil
                           ];

  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];

  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsSetJsonFileContents:(CDVInvokedUrlCommand *)command {
  NSString *toPath = [command.arguments objectAtIndex:0];
  NSDictionary *jsonDict = [command.arguments objectAtIndex:1];
  NSError *error = nil;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:jsonDict options:kNilOptions error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }

  BOOL written = [self writeFile:toPath withData:jsonData synced:@YES error:&error];
  
  if (!written) {
    [self returnError:error forCommand:command];
    return;
  }
  
  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsRemoveJsonFile:(CDVInvokedUrlCommand *)command {
  NSString *path = [command.arguments objectAtIndex:0];
  NSError *error;
  BOOL success = [self removeFile:path synced:@YES error:&error];
  if (!success) {
    [self returnError:error forCommand:command];
    return;
  }

  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsListJsonFiles:(CDVInvokedUrlCommand *)command {
  NSString *path = [command.arguments objectAtIndex:0];
  NSError *error;
  NSArray *results = [self readDirectory:path synced:@YES error:&error];
  if (error) {
    [self returnError:error forCommand:command];
    return;
  }

  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           results, @"contents",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsGetPrivateJsonFileContents:(CDVInvokedUrlCommand *)command {
  NSString *filePath = [command.arguments objectAtIndex:0];

  NSError *error = nil;
  NSData *data = [self readFile:filePath synced:@NO error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }

  NSDictionary *jsonData = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }
  
  NSDictionary *jsonObj = [
                           [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           jsonData, @"contents",
                           @YES, @"success",
                           nil
                           ];

  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];

  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsSetPrivateJsonFileContents:(CDVInvokedUrlCommand *)command {
  NSString *toPath = [command.arguments objectAtIndex:0];
  NSDictionary *jsonDict = [command.arguments objectAtIndex:1];
  NSError *error = nil;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:jsonDict options:kNilOptions error:&error];

  if (error) {
    [self returnError:error forCommand:command];
    return;
  }

  BOOL written = [self writeFile:toPath withData:jsonData synced:@NO error:&error];
  
  if (!written) {
    [self returnError:error forCommand:command];
    return;
  }
  
  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsRemovePrivateJsonFile:(CDVInvokedUrlCommand *)command {
  NSString *path = [command.arguments objectAtIndex:0];
  NSError *error;
  BOOL success = [self removeFile:path synced:@NO error:&error];
  if (!success) {
    [self returnError:error forCommand:command];
    return;
  }

  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) onmsListPrivateJsonFiles:(CDVInvokedUrlCommand *)command {
  NSString *path = [command.arguments objectAtIndex:0];
  NSError *error;
  NSArray *results = [self readDirectory:path synced:@NO error:&error];
  if (error) {
    [self returnError:error forCommand:command];
    return;
  }
  
  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @YES, @"success",
                           results, @"contents",
                           nil
                           ];
  
  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_OK
                                   messageAsDictionary : jsonObj
                                   ];
  
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

#pragma mark - Internal

- (NSData *) readFile:(NSString*)fromPath synced:(BOOL)synced error:(__autoreleasing NSError **)error {
  NSString *fileName = [self getFilePath:fromPath synced:synced];

  BOOL fileExists = [[NSFileManager defaultManager] fileExistsAtPath:fileName];
  if (!fileExists) {
    NSString *failureReason = [NSString stringWithFormat:@"The file '%@' does not exist.", fromPath];
    NSDictionary *userInfo = @{
      NSLocalizedDescriptionKey: NSLocalizedString(@"File does not exist.", nil),
      NSLocalizedFailureReasonErrorKey: NSLocalizedString(failureReason, nil)
    };
    if (error != NULL) *error = [NSError errorWithDomain:@"org.opennms.cordova.storage" code:1 userInfo:userInfo];
    return nil;
  }

  NSData *fileContents = [[NSData alloc]
                            initWithContentsOfFile : fileName
                            options                : NSDataReadingMappedIfSafe
                            error                  : error
                            ];
  
  return fileContents;
}

- (BOOL) writeFile:(NSString *)toPath withData:(NSData *)fileData synced:(BOOL)synced error:(__autoreleasing NSError **)error {
  NSString *fileName = [self getFilePath:toPath synced:synced];
  
  BOOL success = [[NSFileManager defaultManager] createDirectoryAtPath:[fileName stringByDeletingLastPathComponent] 
    withIntermediateDirectories:YES
    attributes:nil
    error:error];

  if (!success) {
    return success;
  }

  return [fileData writeToFile : fileName
                options     : NSDataWritingAtomic
                error       : error];
}

- (BOOL) removeFile:(NSString *)filePath synced:(BOOL)synced error:(__autoreleasing NSError **)error {
  NSString *fileName = [self getFilePath:filePath synced:synced];
  if ([[NSFileManager defaultManager] isDeletableFileAtPath:fileName]) {
    return [[NSFileManager defaultManager] removeItemAtPath:fileName error:error];
  } else {
    NSString *failureReason = [NSString stringWithFormat:@"The file '%@' cannot be deleted.", filePath];
    NSDictionary *userInfo = @{
      NSLocalizedDescriptionKey: NSLocalizedString(@"File cannot be deleted.", nil),
      NSLocalizedFailureReasonErrorKey: NSLocalizedString(failureReason, nil)
    };
    if (error != NULL) *error = [NSError errorWithDomain:@"org.opennms.cordova.storage" code:2 userInfo:userInfo];
    return false;
  }
}

- (NSString *) getFilePath:(NSString *)forPath synced:(BOOL)synced {
  NSString *libPath = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES)[0];
  NSString *libPathSync = [libPath stringByAppendingPathComponent:@"Cloud"];
  NSString *libPathNoSync = [libPath stringByAppendingPathComponent:@"NoCloud"];

  return [NSString stringWithFormat:@"%@/%@", (synced?libPathSync:libPathNoSync), forPath];
}

- (NSArray *) readDirectory:(NSString *)path synced:(BOOL)synced error:(__autoreleasing NSError **)error {
  NSString *dirName = [self getFilePath:path synced:synced];
  BOOL isDir;
  if ([[NSFileManager defaultManager] fileExistsAtPath:dirName isDirectory:&isDir] && isDir) {
    return [[NSFileManager defaultManager] contentsOfDirectoryAtPath:dirName error:error];
  } else {
    NSString *failureReason = [NSString stringWithFormat:@"The directory '%@' does not exist.", path];
    NSDictionary *userInfo = @{
                               NSLocalizedDescriptionKey: NSLocalizedString(@"Directory missing..", nil),
                               NSLocalizedFailureReasonErrorKey: NSLocalizedString(failureReason, nil)
                               };
    if (error != NULL) *error = [NSError errorWithDomain:@"org.opennms.cordova.storage" code:3 userInfo:userInfo];
    return nil;
  }
}

- (void) returnError:(NSError *)error forCommand:(CDVInvokedUrlCommand *)command {
  NSDictionary *jsonObj = [ [NSDictionary alloc]
                           initWithObjectsAndKeys :
                           @NO, @"success",
                           error.localizedDescription, @"error",
                           error.localizedFailureReason, @"reason",
                           nil
                           ];

  CDVPluginResult *pluginResult = [ CDVPluginResult
                                   resultWithStatus    : CDVCommandStatus_ERROR
                                   messageAsDictionary : jsonObj
                                   ];
  [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}



@end
