//
//  ONMSCloudStorage.h
//  Cordova Cloud Storage Plugin
//
//  Created by Benjamin Reed on 7/20/15.
//
//

#import <Cordova/CDV.h>

@interface ONMSCloudStorage : CDVPlugin

- (void) onmsGetJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsSetJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsRemoveJsonFile:(CDVInvokedUrlCommand *)command;
- (void) onmsListJsonFiles:(CDVInvokedUrlCommand *)command;

- (void) onmsGetPrivateJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsSetPrivateJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsRemovePrivateJsonFile:(CDVInvokedUrlCommand *)command;
- (void) onmsListPrivateJsonFiles:(CDVInvokedUrlCommand *)command;

#pragma mark - Internal

- (BOOL) writeFile:(NSString *)toPath withData:(NSData *)data synced:(BOOL)synced error:(__autoreleasing NSError **)error;
- (NSData *) readFile:(NSString *)fromPath synced:(BOOL)synced error:(__autoreleasing NSError **)error;
- (BOOL) removeFile:(NSString *)filePath synced:(BOOL)synced error:(__autoreleasing NSError **)error;
- (NSString *) getFilePath:(NSString *)forPath synced:(BOOL)synced;
- (NSArray *) readDirectory:(NSString *)path synced:(BOOL)synced error:(__autoreleasing NSError **)error;

@end
