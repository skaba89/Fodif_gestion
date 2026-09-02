import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, /metrics itself included (its own request duration is a legitimate metric too;
    // it stays cheap since it neither hits the database nor the object store).
    // '*path' (named wildcard), not the bare '*' every NestJS/Express example still shows for
    // "all routes" - the path-to-regexp version behind Nest 11 rejects the bare form outright in
    // its next major, and already warns on it today (confirmed against a live server: the warning
    // disappeared switching to '*path', matching the Nest migration guide's own suggested fix).
    consumer.apply(MetricsMiddleware).forRoutes('*path');
  }
}
